# frozen_string_literal: true

module FitGap
  # N13: Generates a fit/gap report comparing a portfolio against a vacancy.
  # Uses rule-based comparison for skill levels + Gemini Flash for culture narrative.
  class Engine
    def initialize(portfolio:, vacancy:, gemini_client: nil)
      @portfolio = portfolio
      @vacancy   = vacancy
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-3.5-flash'),
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

      ActiveRecord::Base.transaction do
        report.update!(
          skill_comparisons: skill_comparisons,
          culture_narrative: narratives[:culture],
          overall_narrative: narratives[:overall],
          generated_at:      Time.current
        )
      end

      Rails.logger.info("[N13] Fit/gap report generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id}")
      report
    end

    private

    def build_skill_comparisons
      vacancy_skills   = @vacancy.vacancy_skills.index_by { |s| s.skill_label.to_s.downcase.strip }
      portfolio_skills = effective_portfolio_skills  # includes overrides

      vacancy_skills.map do |normalized_label, vacancy_skill|
        portfolio_skill = find_portfolio_skill(portfolio_skills, vacancy_skill.skill_label, vacancy_skill.skill_id)

        if portfolio_skill
          candidate_level  = portfolio_skill[:effective_level]
          expected_level   = vacancy_skill.expected_level
          delta            = candidate_level - expected_level
          result           = delta.zero? ? 'match' : (delta.positive? ? 'exceed' : 'gap')
        else
          candidate_level = nil
          expected_level  = vacancy_skill.expected_level
          delta           = nil
          result          = 'not_assessed'
        end

        {
          skill_label:     vacancy_skill.skill_label,
          skill_id:        vacancy_skill.skill_id,
          candidate_level: candidate_level,
          expected_level:  expected_level,
          result:          result,
          delta:           delta,
          confidence:      portfolio_skill&.dig(:confidence)
        }
      end
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
          overridden:      override.present?,
          is_discovered:   skill.is_discovered
        }
      end
    end

    def find_portfolio_skill(portfolio_skills, label, skill_id)
      clean_label = label.to_s.downcase.strip
      portfolio_skills.find { |s| s[:skill_id] == skill_id && skill_id.present? } ||
        portfolio_skills.find { |s| s[:skill_label].to_s.downcase.strip == clean_label }
    end

    def generate_narratives(skill_comparisons)
      gaps         = skill_comparisons.select { |c| c[:result] == 'gap' }
      matches      = skill_comparisons.select { |c| c[:result] == 'match' }
      exceeds      = skill_comparisons.select { |c| c[:result] == 'exceed' }
      not_assessed = skill_comparisons.select { |c| c[:result] == 'not_assessed' }

      prompt = build_narrative_prompt(gaps, matches, exceeds, not_assessed)

      begin
        response = @gemini_client.generate_content(prompt, temperature: 0.4)
        data = parse_json_safely(response)

        culture = data['culture_narrative'].presence || generate_fallback_culture_narrative(skill_comparisons)
        overall = data['overall_narrative'].presence || generate_fallback_overall_narrative(skill_comparisons)

        { culture: culture, overall: overall }
      rescue => e
        Rails.logger.warn("[N13] Narrative generation failed (#{e.class}: #{e.message}), applying deterministic fallback")
        {
          culture: generate_fallback_culture_narrative(skill_comparisons),
          overall: generate_fallback_overall_narrative(skill_comparisons)
        }
      end
    end

    def build_narrative_prompt(gaps, matches, exceeds, not_assessed)
      vacancy = @vacancy

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
        1. culture_narrative: 2-3 sentences on culture/competency fit based on the comparison patterns and stated culture dimensions.
        2. overall_narrative: 2-3 sentence overall hiring recommendation summary reflecting the matches, gaps, and unassessed areas.

        OUTPUT (JSON only):
        {
          "culture_narrative": "...",
          "overall_narrative": "..."
        }
      PROMPT
    end

    def parse_json_safely(response)
      return response if response.is_a?(Hash)

      raw = response.to_s.strip
      cleaned = raw.sub(/\A```(?:json)?\s*/i, '').sub(/\s*```\z/i, '')
      JSON.parse(cleaned)
    rescue JSON::ParserError
      {}
    end

    def generate_fallback_culture_narrative(comparisons)
      matches = comparisons.count { |c| c[:result] == 'match' }
      exceeds = comparisons.count { |c| c[:result] == 'exceed' }

      if (matches + exceeds) >= (comparisons.size / 2.0)
        "The candidate exhibits strong foundational alignment with the role's core technical requirements and demonstrated problem-solving rigor during evaluation."
      else
        "The candidate demonstrates capability in key assessed areas; deeper behavioral exploration during technical interview is recommended to evaluate organizational alignment."
      end
    end

    def generate_fallback_overall_narrative(comparisons)
      gaps         = comparisons.count { |c| c[:result] == 'gap' }
      matches      = comparisons.count { |c| c[:result] == 'match' }
      exceeds      = comparisons.count { |c| c[:result] == 'exceed' }
      not_assessed = comparisons.count { |c| c[:result] == 'not_assessed' }

      parts = ["Candidate demonstrates #{matches} skill matches, #{exceeds} exceeds, and #{gaps} gaps against requirements for #{@vacancy.role_title}."]
      parts << "#{not_assessed} required skill(s) were not evaluated in this interview and require follow-up assessment." if not_assessed.positive?
      parts.join(' ')
    end
  end
end
