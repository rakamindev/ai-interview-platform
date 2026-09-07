# frozen_string_literal: true

module Portfolios
  # One skill entry from the Gemini portfolio response, parsed and validated.
  #
  # Why this exists (Step 3, Internal + Candidate P0):
  # the generator used to do `skill_data['level'].to_i.clamp(1, 5)`. In Ruby,
  # `nil.to_i` and `"".to_i` are both 0, and 0 clamps to 1 — so a skill the AI
  # never rated silently became a real L1 score that Fit/Gap then treated as a
  # genuine gap in a hiring decision.
  #
  # Here a missing or non-numeric level makes the payload INVALID. Nothing is
  # invented. Rounding/clamping still happens, but only for a level that is
  # actually a number.
  #
  # Plain Ruby on purpose (no ActiveRecord, no ActiveSupport) so it is cheap to
  # unit test without a database.
  class SkillPayload
    LEVEL_RANGE       = (1..5).freeze
    CONFIDENCE_LEVELS = %w[high medium low].freeze
    # Unknown confidence degrades to the most cautious value rather than failing
    # the whole skill — confidence is advisory, the level is what gets compared.
    DEFAULT_CONFIDENCE = 'low'
    MAX_EVIDENCE_QUOTES = 3

    attr_reader :skill_id, :skill_label, :level, :confidence,
                :evidence, :competency_summary, :rejection_reason

    def self.parse(raw, discovered:)
      new(raw, discovered: discovered)
    end

    def initialize(raw, discovered:)
      attrs = raw.is_a?(Hash) ? raw : {}

      @discovered         = discovered
      @skill_id           = discovered ? nil : blank_to_nil(attrs['skill_id'])
      @skill_label        = blank_to_nil(attrs['skill_label'])
      @level              = normalize_level(attrs['level'])
      @confidence         = normalize_confidence(attrs['confidence'])
      @evidence           = normalize_evidence(attrs['evidence'])
      @competency_summary = blank_to_nil(attrs['competency_summary'])
      @rejection_reason   = detect_rejection
    end

    def valid?
      @rejection_reason.nil?
    end

    def discovered?
      @discovered
    end

    # Two entries describing the same skill collapse to one; last one wins.
    def dedup_key
      [@discovered, @skill_id || @skill_label.to_s.downcase.strip]
    end

    def to_attributes
      {
        skill_id:           @skill_id,
        skill_label:        @skill_label,
        is_discovered:      @discovered,
        ai_level:           @level,
        ai_confidence:      @confidence,
        evidence:           @evidence,
        competency_summary: @competency_summary
      }
    end

    private

    def detect_rejection
      return :missing_skill_label if @skill_label.nil?
      return :invalid_level       if @level.nil?
      return :missing_summary     if @competency_summary.nil?

      nil
    end

    # Returns nil for anything that is not a number. Floats are rounded and
    # out-of-range integers are clamped — but only once we know it IS a number.
    def normalize_level(value)
      number =
        case value
        when Integer then value
        when Float   then value.round
        when String  then numeric_string_to_int(value)
        end

      return nil if number.nil?

      number.clamp(LEVEL_RANGE.first, LEVEL_RANGE.last)
    end

    def numeric_string_to_int(value)
      stripped = value.strip
      return nil unless stripped.match?(/\A-?\d+(\.\d+)?\z/)

      stripped.include?('.') ? stripped.to_f.round : stripped.to_i
    end

    def normalize_confidence(value)
      normalized = value.to_s.strip.downcase
      CONFIDENCE_LEVELS.include?(normalized) ? normalized : DEFAULT_CONFIDENCE
    end

    def normalize_evidence(value)
      Array(value).map { |quote| quote.to_s.strip }
                  .reject(&:empty?)
                  .first(MAX_EVIDENCE_QUOTES)
    end

    def blank_to_nil(value)
      string = value.to_s.strip
      string.empty? ? nil : string
    end
  end
end
