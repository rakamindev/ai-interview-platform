# frozen_string_literal: true

module FitGap
  # N13: Generates a fit/gap report comparing a portfolio against a vacancy.
  # Uses rule-based comparison for skill levels + Gemini Flash for culture narrative.
  class Engine
    def initialize(portfolio:, vacancy:, gemini_client: nil)
      @portfolio = portfolio
      @vacancy   = vacancy
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-2.0-flash-001'),
        timeout: 30
      )
    end

    # Returns the FitGapReport record.
    def call
      skill_comparisons = build_skill_comparisons
      narratives        = generate_narratives(skill_comparisons)

      report = FitGapReport.find_or_initialize_by(
        portfolio_id: @portfolio.id,
        vacancy_id:   @vacancy.id
      )

      report.update!(
        skill_comparisons: skill_comparisons,
        culture_narrative: narratives[:culture],
        overall_narrative: narratives[:overall],
        generated_at:      Time.current
      )

      Rails.logger.info("[N13] Fit/gap report generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id}")
      report
    end

    def build_skill_comparisons
      vacancy_skills   = @vacancy.vacancy_skills.index_by(&:skill_label)
      portfolio_skills = effective_portfolio_skills # includes overrides
      coverage_maps    = @portfolio.session.coverage_maps.to_a

      vacancy_skills.map do |label, vacancy_skill|
        portfolio_skill = find_portfolio_skill(portfolio_skills, label, vacancy_skill.skill_id)
        coverage_map    = find_coverage_map(coverage_maps, label, vacancy_skill.skill_id)
        expected_level  = vacancy_skill.expected_level

        if portfolio_skill
          candidate_level   = portfolio_skill[:effective_level]
          delta             = candidate_level - expected_level
          result            = if delta.zero?
                                'match'
                              elsif delta.positive?
                                'exceed'
                              else
                                'gap'
                              end
          assessment_status = coverage_map&.state == 'partial' ? 'partial' : 'covered'
        else
          candidate_level   = nil
          delta             = nil
          result            = 'not_assessed'
          assessment_status = if coverage_map && (coverage_map.state == 'initiated' || coverage_map.probe_count.to_i.positive?)
                                'insufficient_evidence'
                              else
                                'not_probed'
                              end
        end

        {
          skill_label:       label,
          skill_id:          vacancy_skill.skill_id,
          required_level:    expected_level,
          expected_level:    expected_level,
          candidate_level:   candidate_level,
          ai_level:          portfolio_skill&.dig(:ai_level),
          is_override:       portfolio_skill ? portfolio_skill[:overridden] : false,
          assessor_notes:    portfolio_skill&.dig(:assessor_notes),
          assessment_status: assessment_status,
          result:            result,
          delta:             delta,
          confidence:        portfolio_skill&.dig(:confidence)
        }
      end
    end

    private

    # Returns portfolio skills with overrides applied.
    def effective_portfolio_skills
      @portfolio.portfolio_skills.includes(:assessor_override).map do |skill|
        override = skill.assessor_override
        {
          id:              skill.id,
          skill_id:        skill.skill_id,
          skill_label:     skill.skill_label,
          ai_level:        skill.ai_level,
          effective_level: override ? override.override_level : skill.ai_level,
          confidence:      skill.ai_confidence,
          overridden:      override.present?,
          assessor_notes:  override&.assessor_notes
        }
      end
    end

    def find_portfolio_skill(portfolio_skills, label, skill_id)
      portfolio_skills.find { |s| s[:skill_id] == skill_id && skill_id.present? } ||
        portfolio_skills.find { |s| s[:skill_label].downcase == label.downcase }
    end

    def find_coverage_map(coverage_maps, label, skill_id)
      coverage_maps.find { |m| m.skill_id == skill_id && skill_id.present? } ||
        coverage_maps.find { |m| m.skill_label.to_s.casecmp?(label.to_s) }
    end

    def generate_narratives(skill_comparisons)
      gaps         = skill_comparisons.select { |c| c[:result] == 'gap' }
      matches      = skill_comparisons.select { |c| c[:result] == 'match' }
      exceeds      = skill_comparisons.select { |c| c[:result] == 'exceed' }
      not_assessed = skill_comparisons.select { |c| c[:result] == 'not_assessed' }

      prompt = build_narrative_prompt(gaps, matches, exceeds, not_assessed)

      begin
        response = @gemini_client.generate_content(prompt, temperature: 0.4)
        data = response.is_a?(Hash) ? response : JSON.parse(response)
        {
          culture: data['culture_narrative'].presence,
          overall: data['overall_narrative'].presence || generate_fallback_narrative(skill_comparisons)
        }
      rescue StandardError => e
        Rails.logger.error("[N13] Narrative generation failed: #{e.message}")
        { culture: nil, overall: generate_fallback_narrative(skill_comparisons) }
      end
    end

    def build_narrative_prompt(gaps, matches, exceeds, not_assessed)
      vacancy = @vacancy

      <<~PROMPT
        You are writing a fit/gap analysis narrative for a candidate evaluation.

        ROLE: #{vacancy.role_title}
        #{vacancy.culture_dimensions.present? ? "CULTURE EXPECTATIONS:\n#{vacancy.culture_dimensions}\n" : ''}
        #{vacancy.competency_expectations.present? ? "COMPETENCY EXPECTATIONS:\n#{vacancy.competency_expectations}\n" : ''}

        SKILL COMPARISON RESULTS:
        - Matches (#{matches.count}): #{matches.map { |c| "#{c[:skill_label]} (L#{c[:candidate_level]})" }.join(', ')}
        - Gaps (#{gaps.count}): #{gaps.map { |c| "#{c[:skill_label]}: candidate L#{c[:candidate_level]} vs expected L#{c[:expected_level]} (delta #{c[:delta]})" }.join(', ')}
        - Exceeds (#{exceeds.count}): #{exceeds.map { |c| "#{c[:skill_label]}: candidate L#{c[:candidate_level]} vs expected L#{c[:expected_level]} (+#{c[:delta]})" }.join(', ')}
        - Not assessed (#{not_assessed.count}): #{not_assessed.map { |c| c[:skill_label] }.join(', ')}

        Write two short narrative paragraphs:
        1. culture_narrative: 2-3 sentences on culture/competency fit based on the comparison patterns.
        2. overall_narrative: 2-3 sentence overall hiring recommendation summary.

        OUTPUT (JSON only):
        {
          "culture_narrative": "...",
          "overall_narrative": "..."
        }
      PROMPT
    end

    def generate_fallback_narrative(comparisons)
      gaps         = comparisons.count { |c| (c[:result] || c['result']) == 'gap' }
      matches      = comparisons.count { |c| (c[:result] || c['result']) == 'match' }
      exceeds      = comparisons.count { |c| (c[:result] || c['result']) == 'exceed' }
      not_assessed = comparisons.count { |c| (c[:result] || c['result']) == 'not_assessed' }

      "Candidate shows #{matches} skill matches, #{exceeds} exceeds, #{gaps} gaps, and #{not_assessed} not assessed against role requirements."
    end
  end
end
