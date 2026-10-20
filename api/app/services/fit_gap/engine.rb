# frozen_string_literal: true

module FitGap
  # N13: Generates a fit/gap report comparing a portfolio against a vacancy.
  # Uses rule-based comparison for skill levels + Gemini Flash for culture narrative.
  class Engine
    def initialize(portfolio:, vacancy:, gemini_client: nil)
      @portfolio = portfolio
      @vacancy   = vacancy
      tenant     = @vacancy.tenant || @portfolio.session&.tenant
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        organization: tenant,
        model:        tenant&.gemini_model(:flash) || ENV['GEMINI_FLASH_MODEL'].presence || 'gemini-2.0-flash-001',
        timeout:      30
      )
    end

    # Returns the FitGapReport record.
    def call
      skill_comparisons = build_skill_comparisons
      discovered_skills = effective_portfolio_skills.select { |s| s[:is_discovered] }
      narratives        = generate_narratives(skill_comparisons, discovered_skills)

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

    private

    def build_skill_comparisons
      portfolio_skills = effective_portfolio_skills  # includes overrides

      @vacancy.vacancy_skills.map do |vacancy_skill|
        portfolio_skill = find_portfolio_skill(portfolio_skills, vacancy_skill)

        candidate_level = portfolio_skill&.dig(:effective_level)
        expected_level  = vacancy_skill.expected_level

        if candidate_level.present? && expected_level.present?
          delta  = candidate_level - expected_level
          result = delta == 0 ? 'match' : (delta > 0 ? 'exceed' : 'gap')
        else
          delta  = nil
          result = 'not_assessed'
        end

        {
          skill_label:     vacancy_skill.skill_label,
          skill_id:        vacancy_skill.skill_id,
          is_custom:       vacancy_skill.is_custom?,
          candidate_level: candidate_level,
          expected_level:  expected_level,
          result:          result,
          delta:           delta,
          confidence:      portfolio_skill&.dig(:confidence),
          overridden:      portfolio_skill&.dig(:overridden) || false
        }
      end
    end

    # Returns portfolio skills with overrides applied.
    def effective_portfolio_skills
      @effective_portfolio_skills ||= @portfolio.portfolio_skills.includes(:assessor_override).map do |skill|
        override = skill.assessor_override
        {
          id:              skill.id,
          skill_id:        skill.skill_id,
          skill_label:     skill.skill_label,
          is_discovered:   skill.is_discovered,
          ai_level:        skill.ai_level,
          effective_level: override ? override.override_level : skill.ai_level,
          confidence:      skill.ai_confidence,
          overridden:      override.present?
        }
      end
    end

    # Hybrid matching: 1. match by taxonomy skill_id when both present, 2. normalized label fallback.
    def find_portfolio_skill(portfolio_skills, vacancy_skill)
      if vacancy_skill.skill_id.present?
        by_id = portfolio_skills.find { |s| s[:skill_id].present? && s[:skill_id] == vacancy_skill.skill_id }
        return by_id if by_id
      end

      normalized = vacancy_skill.skill_label.to_s.strip.downcase
      portfolio_skills.find do |s|
        s[:skill_label].to_s.strip.downcase == normalized
      end
    end

    def generate_narratives(skill_comparisons, discovered_skills = [])
      gaps         = skill_comparisons.select { |c| c[:result] == 'gap' }
      matches      = skill_comparisons.select { |c| c[:result] == 'match' }
      exceeds      = skill_comparisons.select { |c| c[:result] == 'exceed' }
      not_assessed = skill_comparisons.select { |c| c[:result] == 'not_assessed' }

      prompt = build_narrative_prompt(gaps, matches, exceeds, not_assessed, discovered_skills)

      begin
        response = @gemini_client.generate_content(prompt, temperature: 0.4)
        data = response.is_a?(Hash) ? response : JSON.parse(response)
        { culture: data['culture_narrative'], overall: data['overall_narrative'] }
      rescue => e
        Rails.logger.error("[N13] Narrative generation failed: #{e.message}")
        { culture: nil, overall: generate_fallback_narrative(skill_comparisons) }
      end
    end

    def build_narrative_prompt(gaps, matches, exceeds, not_assessed, discovered_skills = [])
      vacancy = @vacancy
      portfolio_session = @portfolio.session
      assessment = portfolio_session.assessment

      discovered_text = if discovered_skills.any?
        formatted = discovered_skills.map do |s|
          "#{s[:skill_label]} (L#{s[:effective_level] || 'unassessed'})"
        end.join(', ')
        "- Discovered candidate strengths (#{discovered_skills.count}): #{formatted}"
      else
        "- Discovered candidate strengths: None"
      end

      <<~PROMPT
        You are writing a fit/gap analysis narrative for a candidate evaluation.

        ROLE: #{vacancy.role_title}
        #{vacancy.culture_dimensions.present? ? "CULTURE EXPECTATIONS:\n#{vacancy.culture_dimensions}\n" : ""}
        #{vacancy.competency_expectations.present? ? "COMPETENCY EXPECTATIONS:\n#{vacancy.competency_expectations}\n" : ""}

        SKILL COMPARISON RESULTS:
        - Matches (#{matches.count}): #{matches.map { |c| "#{c[:skill_label]} (L#{c[:candidate_level]})" }.join(', ')}
        - Gaps (#{gaps.count}): #{gaps.map { |c| "#{c[:skill_label]}: candidate L#{c[:candidate_level]} vs expected L#{c[:expected_level]} (delta #{c[:delta]})" }.join(', ')}
        - Exceeds (#{exceeds.count}): #{exceeds.map { |c| "#{c[:skill_label]}: candidate L#{c[:candidate_level]} vs expected L#{c[:expected_level]} (+#{c[:delta]})" }.join(', ')}
        - Not assessed (#{not_assessed.count}): #{not_assessed.map { |c| c[:skill_label] }.join(', ')}
        #{discovered_text}

        Write two short narrative paragraphs:
        1. culture_narrative: 2-3 sentences on culture/competency fit based on the comparison patterns and discovered strengths.
        2. overall_narrative: 2-3 sentence overall hiring recommendation summary including bonus competencies.

        OUTPUT (JSON only):
        {
          "culture_narrative": "...",
          "overall_narrative": "..."
        }
      PROMPT
    end

    def generate_fallback_narrative(comparisons)
      gaps         = comparisons.count { |c| c[:result] == 'gap' }
      matches      = comparisons.count { |c| c[:result] == 'match' }
      exceeds      = comparisons.count { |c| c[:result] == 'exceed' }
      not_assessed = comparisons.count { |c| c[:result] == 'not_assessed' }

      summary = "Candidate shows #{matches} skill matches, #{exceeds} exceeds, and #{gaps} gaps against role requirements."
      if not_assessed > 0
        "#{summary} #{not_assessed} #{not_assessed == 1 ? 'skill was' : 'skills were'} not assessed during this session and require follow-up evaluation."
      else
        summary
      end
    end
  end
end
