# frozen_string_literal: true

module FitGap
  class NarrativeGenerationError < StandardError; end

  # Generates the AI narrative for a Fit/Gap report from aggregate comparison
  # data and Vacancy expectations. Never determines match/gap/exceed/not_assessed;
  # deterministic classification lives in FitGap::ComparisonBuilder.
  # Used by FitGapGeneratorWorker via #generate_narrative!; errors surface as
  # narrative_status=failed instead of rule-based fallback prose.
  class NarrativeGenerator
    def initialize(vacancy:, gemini_client: nil)
      @vacancy = vacancy
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-3.5-flash'),
        timeout: 30
      )
    end

    # Strict path used by the narrative worker. Errors must reach the worker so
    # report state becomes failed instead of presenting fallback prose as AI output.
    def generate_narrative!(skill_comparisons)
      comparisons = normalize_comparisons(skill_comparisons)
      gaps = comparisons.select { |comparison| comparison[:result] == "gap" }
      matches = comparisons.select { |comparison| comparison[:result] == "match" }
      exceeds = comparisons.select { |comparison| comparison[:result] == "exceed" }
      not_assessed = comparisons.select { |comparison| comparison[:result] == "not_assessed" }

      response = @gemini_client.generate_content(
        build_narrative_prompt(gaps, matches, exceeds, not_assessed),
        temperature: 0.4
      )
      data = response.is_a?(Hash) ? response : JSON.parse(response)
      culture = data["culture_narrative"] || data[:culture_narrative]
      overall = data["overall_narrative"] || data[:overall_narrative]

      unless culture.respond_to?(:to_str) && overall.respond_to?(:to_str) && culture.present? && overall.present?
        raise NarrativeGenerationError, "Gemini response missing narrative fields"
      end

      { culture: culture, overall: overall }
    rescue JSON::ParserError => e
      raise NarrativeGenerationError, "Gemini response was not valid JSON: #{e.message}"
    end

    private

    def normalize_comparisons(skill_comparisons)
      Array(skill_comparisons).map do |comparison|
        comparison.respond_to?(:deep_symbolize_keys) ? comparison.deep_symbolize_keys : comparison
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
        1. culture_narrative: 2-3 sentences on culture/competency fit based on the comparison patterns.
        2. overall_narrative: 2-3 sentence overall hiring recommendation summary.

        OUTPUT (JSON only):
        {
          "culture_narrative": "...",
          "overall_narrative": "..."
        }
      PROMPT
    end
  end
end
