# frozen_string_literal: true

module SkillTaxonomies
  # Given a free-text skill name an assessor typed, asks Gemini whether it
  # closely matches one of the existing skill_taxonomies entries — so custom
  # skills can be steered toward the shared taxonomy instead of drifting into
  # text that will never match a vacancy's skills during fit/gap comparison.
  class SuggestMatch
    def initialize(skill_label:, gemini_client: nil)
      @skill_label = skill_label
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-2.0-flash-001'),
        timeout: 20
      )
    end

    # Returns { skill: SkillTaxonomy, confidence:, reasoning: } or nil (no good match).
    def call
      taxonomy = SkillTaxonomy.order(:skill_id).to_a
      return nil if taxonomy.empty?

      response = @gemini_client.generate_content(build_prompt(taxonomy), temperature: 0.1)
      data = response.is_a?(Hash) ? response : JSON.parse(response)

      match_id = data['match_skill_id']
      return nil if match_id.blank?

      skill = taxonomy.find { |s| s.skill_id == match_id }
      return nil unless skill

      { skill: skill, confidence: data['confidence'], reasoning: data['reasoning'] }
    rescue JSON::ParserError, Gemini::HttpClient::ApiError => e
      Rails.logger.error("[SkillTaxonomies::SuggestMatch] Failed: #{e.class}: #{e.message}")
      nil
    end

    private

    def build_prompt(taxonomy)
      list = taxonomy.map { |s| "- #{s.skill_id}: #{s.skill_label} — #{s.scope_include}" }.join("\n")

      <<~PROMPT
        A hiring assessor typed a custom skill name while building an interview
        assessment. Determine whether it closely matches one of the skills in
        our existing taxonomy below — a match means it's essentially the same
        competency, not just loosely related.

        TYPED SKILL: "#{@skill_label}"

        TAXONOMY:
        #{list}

        Only report a match if you're confident it's the same competency
        (allowing for rephrasing/translation/abbreviation). If it's a
        genuinely different or more specific skill, return null — a wrong
        match is worse than no match.

        OUTPUT (JSON only, no prose):
        {
          "match_skill_id": "SK-XXX-000" or null,
          "confidence": "high" | "medium" | "low",
          "reasoning": "brief explanation"
        }
      PROMPT
    end
  end
end
