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
        generated_at:      Time.current,
        generation_status: 'complete',
        generation_error:  nil
      )

      Rails.logger.info("[N13] Fit/gap report generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id}")
      report
    end

    private

    def build_skill_comparisons
      ComparisonBuilder.new(portfolio: @portfolio, vacancy: @vacancy).call
    end

    def generate_narratives(skill_comparisons)
      gaps    = skill_comparisons.select { |c| c[:result] == 'gap' }
      matches = skill_comparisons.select { |c| c[:result] == 'match' }
      exceeds = skill_comparisons.select { |c| c[:result] == 'exceed' }
      not_assessed = skill_comparisons.select { |c| c[:result] == 'not_assessed' }

      prompt = build_narrative_prompt(gaps, matches, exceeds, not_assessed)

      begin
        response = @gemini_client.generate_content(prompt, temperature: 0.4)
        data = response.is_a?(Hash) ? response : JSON.parse(response)
        { culture: data['culture_narrative'], overall: data['overall_narrative'] }
      rescue => e
        Rails.logger.error("[N13] Narrative generation failed: #{e.message}")
        { culture: nil, overall: generate_fallback_narrative(skill_comparisons) }
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
        - Matches (#{matches.count}): #{comparison_details(matches)}
        - Gaps (#{gaps.count}): #{comparison_details(gaps)}
        - Exceeds (#{exceeds.count}): #{comparison_details(exceeds)}
        - Not assessed (#{not_assessed.count}): #{not_assessed.map { |c| c[:skill_label] }.join(', ')}

        IMPORTANT DECISION-SAFETY RULES:
        - This report is decision support, not an automated hiring decision.
        - Do NOT recommend hire/reject, rank the candidate, or infer traits not supported by evidence.
        - Treat "not assessed" as unknown evidence, never as a gap.
        - Call out low-confidence results as areas that need human follow-up.
        - Base claims only on the competency summaries and comparison data above.

        Write two short narrative paragraphs:
        1. culture_narrative: 2-3 sentences describing evidence relevant to the role's culture/competency expectations, with uncertainty where appropriate.
        2. overall_narrative: 2-3 sentences summarizing strengths, gaps, and unknowns without making a hiring recommendation.

        OUTPUT (JSON only):
        {
          "culture_narrative": "...",
          "overall_narrative": "..."
        }
      PROMPT
    end

    def comparison_details(comparisons)
      return 'none' if comparisons.empty?

      comparisons.map do |comparison|
        level_text = if comparison[:candidate_level]
                       "candidate L#{comparison[:candidate_level]} vs expected L#{comparison[:expected_level]}"
                     else
                       "not assessed vs expected L#{comparison[:expected_level]}"
                     end
        confidence = comparison[:confidence] ? ", confidence=#{comparison[:confidence]}" : ''
        override = comparison[:overridden] ? ', assessor override applied' : ''
        summary = comparison[:competency_summary].present? ? ", evidence summary: #{comparison[:competency_summary]}" : ''

        "#{comparison[:skill_label]} (#{level_text}#{confidence}#{override}#{summary})"
      end.join(' | ')
    end

    def generate_fallback_narrative(comparisons)
      gaps    = comparisons.count { |c| c[:result] == 'gap' }
      matches = comparisons.count { |c| c[:result] == 'match' }
      exceeds = comparisons.count { |c| c[:result] == 'exceed' }

      not_assessed = comparisons.count { |c| c[:result] == 'not_assessed' }
      low_confidence = comparisons.count { |c| c[:confidence] == 'low' }

      summary = "Evidence shows #{matches} matches, #{exceeds} exceeds, and #{gaps} gaps against the configured role requirements."
      summary += " #{not_assessed} required skill#{'s' unless not_assessed == 1} were not assessed and should be treated as unknown." if not_assessed.positive?
      summary += " #{low_confidence} comparison#{'s' unless low_confidence == 1} have low confidence and need human follow-up." if low_confidence.positive?
      summary
    end
  end
end
