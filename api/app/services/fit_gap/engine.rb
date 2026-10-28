# frozen_string_literal: true

module FitGap
  # N13: Generates a fit/gap report comparing a portfolio against a vacancy.
  # Uses rule-based comparison for skill levels + Gemini Flash for culture narrative.
  class Engine
    def initialize(portfolio:, vacancy:, generation_started_at:, generation_token:, gemini_client: nil)
      @portfolio = portfolio
      @vacancy   = vacancy
      @generation_started_at = generation_started_at
      @generation_token = generation_token
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

      updated = false
      report.with_lock do
        next unless report.generation_status == "generating" &&
                    report.generation_started_at == @generation_started_at &&
                    report.generation_token == @generation_token

        report.update!(
          skill_comparisons: skill_comparisons,
          culture_narrative: narratives[:culture],
          overall_narrative: narratives[:overall],
          generated_at:      Time.current,
          generation_status: 'complete',
          generation_started_at: nil,
          generation_token: nil
        )
        updated = true
      end

      unless updated
        Rails.logger.info("[N13] Discarded superseded fit/gap generation: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id}")
        return report
      end

      Rails.logger.info("[N13] Fit/gap report generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id}")
      report
    end

    private

    def build_skill_comparisons
      vacancy_skills = @vacancy.vacancy_skills
      portfolio_skills = effective_portfolio_skills  # includes overrides

      comparisons = vacancy_skills.map do |vacancy_skill|
        label = vacancy_skill.skill_label
        portfolio_skill = find_portfolio_skill(portfolio_skills, label, vacancy_skill.skill_id)

        if portfolio_skill
          candidate_level  = portfolio_skill[:effective_level]
          expected_level   = vacancy_skill.expected_level
          delta            = candidate_level - expected_level
          result           = delta == 0 ? 'match' : (delta > 0 ? 'exceed' : 'gap')
          is_override      = portfolio_skill[:overridden]
        else
          candidate_level = nil
          expected_level  = vacancy_skill.expected_level
          delta           = nil
          result          = 'not_assessed'
          is_override     = false
        end

        {
          skill_label:     label,
          skill_id:        vacancy_skill.skill_id,
          candidate_level: candidate_level,
          expected_level:  expected_level,
          result:          result,
          delta:           delta,
          confidence:      portfolio_skill&.dig(:confidence),
          is_override:     is_override
        }
      end

      comparisons
    end

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
          overridden:      override.present?
        }
      end
    end

    def find_portfolio_skill(portfolio_skills, label, skill_id)
      portfolio_skills.find { |s| s[:skill_id] == skill_id && skill_id.present? } ||
        portfolio_skills.find { |s| s[:skill_label].downcase == label.downcase }
    end

    def generate_narratives(skill_comparisons)
      return { culture: nil, overall: generate_fallback_narrative(skill_comparisons) } if skill_comparisons.empty?

      gaps    = skill_comparisons.select { |c| c[:result] == 'gap' }
      matches = skill_comparisons.select { |c| c[:result] == 'match' }
      exceeds = skill_comparisons.select { |c| c[:result] == 'exceed' }
      not_assessed = skill_comparisons.select { |c| c[:result] == 'not_assessed' }

      prompt = build_narrative_prompt(gaps, matches, exceeds, not_assessed)

      begin
        response = @gemini_client.generate_content(prompt, temperature: 0.4)
        data = response.is_a?(Hash) ? response : JSON.parse(response.to_s)
        raise JSON::ParserError, 'Narrative response must be a JSON object' unless data.is_a?(Hash)

        culture = narrative_text(data['culture_narrative'] || data[:culture_narrative])
        overall = narrative_text(data['overall_narrative'] || data[:overall_narrative])
        raise JSON::ParserError, 'Narrative response did not contain usable text' if culture.nil? && overall.nil?

        { culture: culture, overall: overall || generate_fallback_narrative(skill_comparisons) }
      rescue => e
        Rails.logger.error("[N13] Narrative generation failed: #{e.class}")
        { culture: nil, overall: generate_fallback_narrative(skill_comparisons) }
      end
    end

    def narrative_text(value)
      value.is_a?(String) && value.present? ? value : nil
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
        - Gaps (#{gaps.count}): #{gaps.map { |c| "#{c[:skill_label]}: candidate L#{c[:candidate_level]} vs expected L#{c[:expected_level]} (delta #{c[:delta]})" }.join(', ')}
        - Exceeds (#{exceeds.count}): #{exceeds.map { |c| "#{c[:skill_label]}: candidate L#{c[:candidate_level]} vs expected L#{c[:expected_level]} (+#{c[:delta]})" }.join(', ')}
        - Not assessed (#{not_assessed.count}): #{not_assessed.map { |c| c[:skill_label] }.join(', ')}

        Write two short narrative paragraphs:
        1. culture_narrative: Culture and interview behavior were not assessed in this prompt. State that limitation; do not infer culture fit.
        2. overall_narrative: Summarize the skill comparison and identify any unassessed requirements. Do not make or recommend a hiring decision.

        OUTPUT (JSON only):
        {
          "culture_narrative": "...",
          "overall_narrative": "..."
        }
      PROMPT
    end

    def generate_fallback_narrative(comparisons)
      if comparisons.empty?
        return "No role skill requirements are configured, so a fit/gap comparison could not be calculated. " \
          "This comparison alone is not a hiring recommendation."
      end

      gaps    = comparisons.count { |c| c[:result] == 'gap' }
      matches = comparisons.count { |c| c[:result] == 'match' }
      exceeds = comparisons.count { |c| c[:result] == 'exceed' }
      not_assessed = comparisons.count { |c| c[:result] == 'not_assessed' }

      "The rule-based comparison found #{matches} skill matches, #{exceeds} skills above the expected level, and #{gaps} gaps. " \
        "#{not_assessed} role requirements were not assessed. This comparison alone is not a hiring recommendation."
    end
  end
end
