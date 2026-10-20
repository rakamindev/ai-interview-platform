# frozen_string_literal: true

module FitGap
  # N13: Generates a fit/gap report comparing a portfolio against a vacancy.
  # Uses rule-based comparison for skill levels + Gemini Flash for culture narrative.
  class Engine
    def initialize(portfolio:, vacancy:, gemini_client: nil)
      @portfolio = portfolio
      @vacancy   = vacancy
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-2.0-flash'),
        timeout: 60
      )
    end

    # Returns the FitGapReport record.
    def call
      skill_comparisons = build_skill_comparisons
      narratives        = generate_narratives(skill_comparisons)
      fingerprint       = FitGapReport.calculate_source_fingerprint(portfolio: @portfolio, vacancy: @vacancy)

      report = FitGapReport.find_or_initialize_by(
        portfolio_id: @portfolio.id,
        vacancy_id:   @vacancy.id
      )

      attrs = {
        skill_comparisons:  skill_comparisons,
        culture_narrative:  narratives[:culture],
        overall_narrative:  narratives[:overall],
        generated_at:       Time.current,
        source_fingerprint: fingerprint
      }

      attrs[:narrative_status] = narratives[:narrative_status] if report.respond_to?(:narrative_status=)

      report.update!(attrs)
      report
    end

    private

    def build_skill_comparisons
      vacancy_skills = @vacancy.vacancy_skills.index_by(&:skill_label)
      portfolio_skills = effective_portfolio_skills

      comparisons = vacancy_skills.map do |label, vacancy_skill|
        portfolio_skill = find_portfolio_skill(portfolio_skills, label, vacancy_skill.skill_id)
        required_level  = vacancy_skill.expected_level

        if portfolio_skill.nil?
          # Skill vacancy was not in interview at all
          {
            skill_label:       label,
            skill_id:          vacancy_skill.skill_id,
            required_level:    required_level,
            expected_level:    required_level, # backward compatibility
            candidate_level:   nil,
            level_source:      nil,
            is_override:       false,
            assessment_status: 'not_assessed',
            result:            'not_assessed',
            reason:            'not_in_interview',
            delta:             nil,
            tentative:         false,
            confidence:        nil
          }
        else
          is_override    = portfolio_skill[:overridden]
          effective_lvl  = portfolio_skill[:effective_level]
          status         = portfolio_skill[:assessment_status]
          level_source   = is_override ? 'assessor' : 'ai'

          # An override on a not_assessed skill makes it evaluated!
          if effective_lvl.present? && (status != 'not_assessed' || is_override)
            delta     = effective_lvl - required_level
            result    = delta == 0 ? 'match' : (delta > 0 ? 'exceed' : 'gap')
            tentative = (status == 'insufficient_evidence' && !is_override)

            {
              skill_label:       label,
              skill_id:          vacancy_skill.skill_id,
              required_level:    required_level,
              expected_level:    required_level, # backward compatibility
              candidate_level:   effective_lvl,
              level_source:      level_source,
              is_override:       is_override,
              assessment_status: is_override ? 'assessed' : status,
              result:            result,
              reason:            nil,
              delta:             delta,
              tentative:         tentative,
              confidence:        portfolio_skill[:confidence]
            }
          else
            # Not assessed, no override
            {
              skill_label:       label,
              skill_id:          vacancy_skill.skill_id,
              required_level:    required_level,
              expected_level:    required_level, # backward compatibility
              candidate_level:   nil,
              level_source:      level_source,
              is_override:       false,
              assessment_status: 'not_assessed',
              result:            'not_assessed',
              reason:            portfolio_skill[:status_reason] || 'not_covered',
              delta:             nil,
              tentative:         false,
              confidence:        nil
            }
          end
        end
      end

      comparisons
    end

    # Returns portfolio skills with overrides applied.
    def effective_portfolio_skills
      @portfolio.portfolio_skills.includes(:assessor_override).map do |skill|
        override = skill.assessor_override
        has_override = override.present? && override.override_level.present?

        effective_level = if has_override
                            override.override_level
                          else
                            skill.ai_level
                          end

        {
          id:                skill.id,
          skill_id:          skill.skill_id,
          skill_label:       skill.skill_label,
          assessment_status: skill.assessment_status || (skill.ai_level ? 'assessed' : 'not_assessed'),
          status_reason:     skill.status_reason,
          ai_level:          skill.ai_level,
          effective_level:   effective_level,
          confidence:        skill.ai_confidence,
          overridden:        has_override
        }
      end
    end

    def find_portfolio_skill(portfolio_skills, label, skill_id)
      portfolio_skills.find { |s| s[:skill_id] == skill_id && skill_id.present? } ||
        portfolio_skills.find { |s| s[:skill_label].to_s.strip.downcase == label.to_s.strip.downcase }
    end

    def generate_narratives(skill_comparisons)
      gaps         = skill_comparisons.select { |c| c[:result] == 'gap' }
      matches      = skill_comparisons.select { |c| c[:result] == 'match' }
      exceeds      = skill_comparisons.select { |c| c[:result] == 'exceed' }
      not_assessed = skill_comparisons.select { |c| c[:result] == 'not_assessed' }

      evaluated_count = gaps.size + matches.size + exceeds.size

      # AC-F5: Kalau tidak ada skill yang dinilai, narasi tidak dibuat sama sekali
      if evaluated_count.zero?
        return {
          culture:          nil,
          overall:          nil,
          narrative_status: 'skipped'
        }
      end

      prompt = build_narrative_prompt(gaps, matches, exceeds, not_assessed)

      begin
        response = @gemini_client.generate_content(prompt, temperature: 0.4)
        data = response.is_a?(Hash) ? response : JSON.parse(response)
        {
          culture:          data['culture_narrative'],
          overall:          data['overall_narrative'],
          narrative_status: 'generated'
        }
      rescue => e
        Rails.logger.error("[N13] Narrative generation failed: #{e.message}")
        {
          culture:          nil,
          overall:          nil,
          narrative_status: 'failed'
        }
      end
    end

    def build_narrative_prompt(gaps, matches, exceeds, not_assessed)
      vacancy = @vacancy
      portfolio_session = @portfolio.session
      assessment = portfolio_session.assessment

      <<~PROMPT
        You are writing a fit/gap analysis narrative for a candidate evaluation.

        ROLE: #{vacancy.role_title}
        #{vacancy.culture_dimensions.present? ? "CULTURE EXPECTATIONS:\n#{vacancy.culture_dimensions}\n" : ""}
        #{vacancy.competency_expectations.present? ? "COMPETENCY EXPECTATIONS:\n#{vacancy.competency_expectations}\n" : ""}

        SKILL COMPARISON RESULTS:
        - Matches (#{matches.count}): #{matches.map { |c| "#{c[:skill_label]} (L#{c[:candidate_level]})" }.join(', ')}
        - Exceeds (#{exceeds.count}): #{exceeds.map { |c| "#{c[:skill_label]} (L#{c[:candidate_level]}, +#{c[:delta]})" }.join(', ')}
        - Gaps (#{gaps.count}): #{gaps.map { |c| "#{c[:skill_label]} (Candidate: L#{c[:candidate_level]}, Required: L#{c[:required_level]})" }.join(', ')}
        - Not Assessed / Not Covered (#{not_assessed.count}): #{not_assessed.map { |c| c[:skill_label] }.join(', ')} (IMPORTANT: These skills were NOT evaluated in this session due to time ceiling or lack of probe. Do NOT draw negative conclusions, do not recommend rejection based on these, and treat them strictly as unmeasured.)

        TASK:
        1. Write an "overall_narrative" (2-3 paragraphs):
           - Focus ONLY on the skills that were actually evaluated.
           - Highlight areas where the candidate exceeds or matches requirements.
           - For gaps, be constructive: what would it take to bridge them?
           - DO NOT conclude rejection or incompetence based on unassessed skills.

        2. Write a "culture_narrative" (1-2 paragraphs):
           - How does the candidate's demonstrated behavior align with role culture expectations?
           - If insufficient evidence for culture fit, state that clearly.

        OUTPUT (JSON only):
        {
          "overall_narrative": "...",
          "culture_narrative": "..."
        }
      PROMPT
    end
  end
end
