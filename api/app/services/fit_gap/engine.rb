# frozen_string_literal: true

module FitGap
  # N13: Generates a fit/gap report comparing a portfolio against a vacancy.
  # Uses rule-based comparison for skill levels + Gemini Flash for culture narrative.
  class Engine
    def initialize(portfolio:, vacancy:, gemini_client: nil)
      @portfolio = portfolio
      @vacancy   = vacancy
      @gemini_client = gemini_client || default_gemini_client
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

    private

    def default_gemini_client
      Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-2.0-flash-001'),
        timeout: 30
      )
    rescue StandardError => e
      Rails.logger.warn("[N13] Gemini client initialization fallback: #{e.message}")
      nil
    end

    def to_level_int(val)
      return nil if val.blank?
      if val.is_a?(Numeric)
        val.to_i
      else
        n = val.to_s.gsub(/\D/, '').to_i
        n > 0 ? n : nil
      end
    end

    def build_skill_comparisons
      vacancy_skills = @vacancy.vacancy_skills.index_by(&:skill_label)
      portfolio_skills = effective_portfolio_skills  # includes overrides

      vacancy_skills.map do |label, vacancy_skill|
        portfolio_skill = find_portfolio_skill(portfolio_skills, label, vacancy_skill.skill_id)

        raw_expected = vacancy_skill.respond_to?(:expected_level) ? vacancy_skill.expected_level : (vacancy_skill.respond_to?(:required_level) ? vacancy_skill.required_level : nil)
        expected_level = to_level_int(raw_expected) || 1

        if portfolio_skill && portfolio_skill[:effective_level].present?
          candidate_level = to_level_int(portfolio_skill[:effective_level])
        else
          candidate_level = nil
        end

        if candidate_level.present?
          delta       = candidate_level - expected_level
          result      = delta == 0 ? 'match' : (delta > 0 ? 'exceed' : 'gap')
          is_override = portfolio_skill[:overridden] || false
          confidence  = portfolio_skill[:confidence]
        else
          delta       = nil
          result      = 'not_assessed'
          is_override = false
          confidence  = nil
        end

        {
          skill_label:     label,
          skill_id:        vacancy_skill.skill_id,
          candidate_level: candidate_level,
          expected_level:  expected_level,
          result:          result,
          delta:           delta,
          confidence:      confidence,
          is_override:     is_override
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
          overridden:      override.present?
        }
      end
    end

    def find_portfolio_skill(portfolio_skills, label, skill_id)
      if skill_id.present?
        match_by_id = portfolio_skills.find { |s| s[:skill_id] == skill_id }
        return match_by_id if match_by_id
      end

      portfolio_skills.find { |s| s[:skill_label].to_s.strip.downcase == label.to_s.strip.downcase }
    end

    def generate_narratives(skill_comparisons)
      return default_fallback_narratives(skill_comparisons) if @gemini_client.nil?

      gaps         = skill_comparisons.select { |c| c[:result] == 'gap' }
      matches      = skill_comparisons.select { |c| c[:result] == 'match' }
      exceeds      = skill_comparisons.select { |c| c[:result] == 'exceed' }
      not_assessed = skill_comparisons.select { |c| c[:result] == 'not_assessed' }

      prompt = build_narrative_prompt(gaps, matches, exceeds, not_assessed)

      begin
        response = @gemini_client.generate_content(prompt, temperature: 0.4)
        data = response.is_a?(Hash) ? response : JSON.parse(response)
        {
          culture: data['culture_narrative'] || generate_fallback_culture_narrative(skill_comparisons),
          overall: data['overall_narrative'] || generate_fallback_narrative(skill_comparisons)
        }
      rescue StandardError => e
        Rails.logger.error("[N13] Narrative generation failed: #{e.class} #{e.message}")
        default_fallback_narratives(skill_comparisons)
      end
    end

    def default_fallback_narratives(skill_comparisons)
      {
        culture: generate_fallback_culture_narrative(skill_comparisons),
        overall: generate_fallback_narrative(skill_comparisons)
      }
    end

    def build_narrative_prompt(gaps, matches, exceeds, not_assessed)
      vacancy = @vacancy
      portfolio_session = @portfolio.session
      assessment = portfolio_session&.assessment

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

    def generate_fallback_culture_narrative(comparisons)
      matches = comparisons.count { |c| c[:result] == 'match' }
      exceeds = comparisons.count { |c| c[:result] == 'exceed' }
      gaps    = comparisons.count { |c| c[:result] == 'gap' }

      if (matches + exceeds) >= gaps
        "Candidate demonstrates strong competency alignment with expectations defined for #{@vacancy.role_title}."
      else
        "Candidate exhibits growth opportunities in critical competency areas required for #{@vacancy.role_title}."
      end
    end

    def generate_fallback_narrative(comparisons)
      gaps    = comparisons.count { |c| c[:result] == 'gap' }
      matches = comparisons.count { |c| c[:result] == 'match' }
      exceeds = comparisons.count { |c| c[:result] == 'exceed' }
      not_assessed = comparisons.count { |c| c[:result] == 'not_assessed' }

      summary = "Candidate shows #{matches} skill matches, #{exceeds} exceeds, and #{gaps} gaps against role requirements."
      summary += " (#{not_assessed} required skills were not assessed)." if not_assessed.positive?
      summary
    end
  end
end
