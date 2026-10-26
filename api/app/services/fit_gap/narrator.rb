# frozen_string_literal: true

module FitGap
  # Writes the culture/overall narrative for a computed comparison.
  #
  # The model is optional: on any failure (timeout, HTTP error, missing API
  # key, prose instead of JSON, missing/empty keys) a deterministic summary is
  # produced instead and marked `source: 'fallback'`, so the report is never
  # blocked by the model and the UI can say which text is AI-written.
  #
  # The prompt deliberately asks for "areas to probe" rather than a hiring
  # recommendation: the decision stays with a human (UU PDP, automated
  # decision-making).
  class Narrator
    MAX_NARRATIVE_LENGTH = 1_500
    MODEL_TIMEOUT_SECONDS = 30

    Narrative = Struct.new(:culture, :overall, :source, keyword_init: true)

    def initialize(inputs:, client: nil)
      @inputs = inputs
      @client = client
    end

    def call(result)
      from_model(result) || fallback(result)
    end

    private

    def from_model(result)
      response = client.generate_content(prompt(result), temperature: 0.4)
      data = response.is_a?(String) ? JSON.parse(response) : response
      return log_invalid('response is not an object') unless data.is_a?(Hash)

      culture = clean(data['culture_narrative'])
      overall = clean(data['overall_narrative'])
      return log_invalid('overall_narrative missing') if overall.nil?

      Narrative.new(culture:, overall:, source: 'ai')
    rescue StandardError => e
      # Class only: messages/bodies may echo prompt content (candidate data).
      Rails.logger.warn("[N13] Narrative model unavailable (#{e.class}) #{log_ids}")
      nil
    end

    def client
      @client ||= Gemini::HttpClient.new(
        model: ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-2.0-flash-001'),
        timeout: MODEL_TIMEOUT_SECONDS
      )
    end

    def clean(value)
      return nil unless value.is_a?(String)

      text = value.strip
      return nil if text.empty?

      text.length > MAX_NARRATIVE_LENGTH ? "#{text[0, MAX_NARRATIVE_LENGTH - 1].rstrip}…" : text
    end

    def log_invalid(reason)
      Rails.logger.warn("[N13] Narrative model returned unusable output (#{reason}) #{log_ids}")
      nil
    end

    def log_ids
      "portfolio=#{@inputs.portfolio.id} vacancy=#{@inputs.vacancy.id}"
    end

    def fallback(result)
      summary = result.summary
      sentences = []
      sentences << "Of #{pluralize(summary[:total], 'required skill')}, the candidate meets " \
                   "#{summary[:match]}, exceeds #{summary[:exceed]} and is below the expected level on #{summary[:gap]}."
      if summary[:not_assessed].positive?
        labels = labels_for(result, 'not_assessed')
        sentences << "#{pluralize(summary[:not_assessed], 'skill')} could not be assessed (#{labels}); " \
                     'missing evidence is not evidence of a gap.'
      end
      if summary[:needs_verification].positive?
        count = summary[:needs_verification]
        sentences << "#{pluralize(count, 'rating')} #{count == 1 ? 'rests' : 'rest'} on limited evidence " \
                     'and should be verified before deciding.'
      end
      gaps = labels_for(result, 'gap')
      sentences << "Areas to probe in the next conversation: #{gaps}." if gaps.present?
      sentences << 'No skills are required by this vacancy yet.' if summary[:total].zero?

      Narrative.new(culture: nil, overall: sentences.join(' '), source: 'fallback')
    end

    def labels_for(result, outcome)
      result.comparisons.select { |c| c[:result] == outcome }.map { |c| c[:skill_label] }.join(', ')
    end

    def pluralize(count, noun)
      "#{count} #{count == 1 ? noun : noun.pluralize}"
    end

    def prompt(result)
      vacancy = @inputs.vacancy
      rows = result.comparisons.map { |c| prompt_row(c) }.join("\n")

      <<~PROMPT
        You are helping an assessor read a skills fit/gap comparison. You do NOT decide whether to hire.

        ROLE: #{vacancy.role_title}
        #{"CULTURE EXPECTATIONS:\n#{vacancy.culture_dimensions}\n" if vacancy.culture_dimensions.present?}
        #{"COMPETENCY EXPECTATIONS:\n#{vacancy.competency_expectations}\n" if vacancy.competency_expectations.present?}
        SKILL COMPARISON (computed by rules; do not change these outcomes):
        #{rows.presence || '(no skills required)'}

        Rules:
        - "not assessed" means the interview produced no usable evidence; never describe it as a weakness.
        - "needs verification" means the rating rests on limited evidence; say so when you mention it.
        - "assessor override" means a human corrected the AI rating; treat it as authoritative.
        - Do not recommend hiring or rejecting. Describe fit and the most useful areas to probe next.
        - Do not mention personal attributes (age, gender, religion, ethnicity, origin, health).

        Write two short paragraphs (2-3 sentences each):
        1. culture_narrative: culture/competency fit based on the comparison patterns.
        2. overall_narrative: overall summary and the areas to probe in the next conversation.

        OUTPUT (JSON only):
        { "culture_narrative": "...", "overall_narrative": "..." }
      PROMPT
    end

    def prompt_row(comparison)
      summary = @inputs.competency_summaries[Comparator.normalize_label(comparison[:skill_label])]
      line = "- #{comparison[:skill_label]}: expected L#{comparison[:expected_level]}, " \
             "#{comparison[:candidate_level] ? "candidate L#{comparison[:candidate_level]}" : 'candidate —'}, " \
             "#{comparison[:result].tr('_', ' ')}"
      line += ', assessor override' if comparison[:is_override]
      line += ', needs verification' if comparison[:needs_verification]
      line += "\n  Evidence summary: #{summary}" if summary.present? && comparison[:result] != 'not_assessed'
      line
    end
  end
end
