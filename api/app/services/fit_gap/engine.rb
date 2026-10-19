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
      decision          = Readiness.call(skill_comparisons)
      narratives        = generate_narratives(skill_comparisons, decision)

      report = FitGapReport.find_or_initialize_by(
        portfolio_id: @portfolio.id,
        vacancy_id:   @vacancy.id
      )

      attributes = {
        skill_comparisons: skill_comparisons,
        culture_narrative: narratives[:culture],
        overall_narrative: narratives[:overall],
        generated_at:      Time.current
      }
      attributes[:decision] = decision if report.has_attribute?(:decision)

      report.update!(attributes)

      Rails.logger.info("[N13] Fit/gap report generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id} verdict=#{decision['verdict']}")
      report
    end

    private

    def build_skill_comparisons
      ComparisonBuilder.build(
        vacancy_skills: @vacancy.vacancy_skills.map { |skill| vacancy_skill_payload(skill) },
        portfolio_skills: effective_portfolio_skills
      )
    end

    def vacancy_skill_payload(skill)
      {
        'skill_id' => skill.skill_id,
        'skill_label' => skill.skill_label,
        'expected_level' => skill.expected_level
      }
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

    def generate_narratives(skill_comparisons, decision)
      gaps    = skill_comparisons.select { |c| c['result'] == 'gap' }
      matches = skill_comparisons.select { |c| c['result'] == 'match' }
      exceeds = skill_comparisons.select { |c| c['result'] == 'exceed' }
      not_assessed = skill_comparisons.select { |c| c['result'] == 'not_assessed' }

      prompt = build_narrative_prompt(gaps, matches, exceeds, not_assessed, decision)

      begin
        response = @gemini_client.generate_content(prompt, temperature: 0.4)
        data = response.is_a?(Hash) ? response : JSON.parse(response)
        {
          culture: data['culture_narrative'],
          overall: [decision['rationale'], data['overall_narrative']].compact.join(' ')
        }
      rescue StandardError => e
        Rails.logger.error("[N13] Narrative generation failed: #{e.class}")
        { culture: nil, overall: fallback_narrative(decision) }
      end
    end

    def build_narrative_prompt(gaps, matches, exceeds, not_assessed, decision)
      vacancy = @vacancy
      portfolio_session = @portfolio.session
      assessment = portfolio_session.assessment

      <<~PROMPT
        You are writing a fit/gap analysis narrative for a candidate evaluation.

        ROLE: #{vacancy.role_title}
        #{vacancy.culture_dimensions.present? ? "CULTURE EXPECTATIONS:\n#{vacancy.culture_dimensions}\n" : ""}
        #{vacancy.competency_expectations.present? ? "COMPETENCY EXPECTATIONS:\n#{vacancy.competency_expectations}\n" : ""}

        SKILL COMPARISON RESULTS:
        - Matches (#{matches.count}): #{matches.map { |c| "#{c['skill_label']} (L#{c['candidate_level']})" }.join(', ')}
        - Gaps (#{gaps.count}): #{gaps.map { |c| "#{c['skill_label']}: candidate L#{c['candidate_level']} vs expected L#{c['expected_level']} (delta #{c['delta']})" }.join(', ')}
        - Exceeds (#{exceeds.count}): #{exceeds.map { |c| "#{c['skill_label']}: candidate L#{c['candidate_level']} vs expected L#{c['expected_level']} (+#{c['delta']})" }.join(', ')}
        - Not assessed (#{not_assessed.count}): #{not_assessed.map { |c| c['skill_label'] }.join(', ')}
        DECISION ALREADY MADE BY RULES (do not contradict it): #{decision['verdict']} — #{decision['rationale']}

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

    def fallback_narrative(decision)
      counts = decision['counts'] || {}
      "Decision: #{decision['verdict']}. #{decision['rationale']} " \
        "Counts — match #{counts['match'].to_i}, exceed #{counts['exceed'].to_i}, " \
        "gap #{counts['gap'].to_i}, not assessed #{counts['not_assessed'].to_i}."
    end
  end
end
