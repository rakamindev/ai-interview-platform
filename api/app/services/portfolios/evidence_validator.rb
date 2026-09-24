# frozen_string_literal: true

module Portfolios
  # Validates model supplied evidence against persisted candidate transcript turns.
  # Unverifiable skills remain visible but cannot carry a score.
  class EvidenceValidator
    class InvalidPayload < StandardError; end
    CONFIDENCE_LEVELS = %w[high medium low].freeze
    MAX_QUOTE_LENGTH = 500
    MAX_SUMMARY_LENGTH = 4_000

    def initialize(turns:)
      @candidate_turns = turns.select { |turn| turn.speaker == 'candidate' }
    end

    def validate(skill_data)
      return not_assessed('insufficient_evidence') unless skill_data.is_a?(Hash)

      level = skill_data['level']
      confidence = skill_data['confidence']
      summary = skill_data['competency_summary']
      quotes = skill_data['evidence']

      return not_assessed('invalid_rating') unless level.instance_of?(Integer) && (1..5).cover?(level)
      return not_assessed('invalid_confidence') unless CONFIDENCE_LEVELS.include?(confidence)
      return not_assessed('invalid_summary') unless summary.is_a?(String) && !summary.strip.empty? && summary.length <= MAX_SUMMARY_LENGTH
      return not_assessed('insufficient_evidence') unless quotes.is_a?(Array) && quotes.length >= 2

      matched = []
      quotes.each do |quote|
        return not_assessed('invalid_evidence') unless quote.is_a?(String) && !quote.strip.empty? && quote.length <= MAX_QUOTE_LENGTH

        turn = @candidate_turns.find do |candidate_turn|
          normalize(candidate_turn.text).include?(normalize(quote))
        end
        return not_assessed('invalid_evidence') unless turn
        return not_assessed('insufficient_evidence') if matched.any? { |item| item[:turn_id] == turn.id }

        matched << { turn_id: turn.id, quote: quote.strip }
      end

      return not_assessed('insufficient_evidence') if matched.length < 2

      {
        assessment_status: 'assessed',
        assessment_reason: nil,
        ai_level: level,
        ai_confidence: confidence,
        evidence: matched.first(3),
        competency_summary: summary.strip
      }
    end

    private

    def not_assessed(reason)
      {
        assessment_status: 'not_assessed',
        assessment_reason: reason,
        ai_level: nil,
        ai_confidence: nil,
        evidence: [],
        competency_summary: ''
      }
    end

    def normalize(value)
      value.to_s.unicode_normalize(:nfc).gsub(/\s+/, ' ').strip.downcase
    end
  end
end
