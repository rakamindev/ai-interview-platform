# frozen_string_literal: true

module Portfolios
  # Turns a model rating into something we are willing to store.
  #
  # A missing or unparsable level must never become L1. That coercion
  # reads as "this person is foundational" when the model simply failed
  # to rate them, and it changes a hiring outcome.
  class RatingNormalizer
    CONFIDENCE_LEVELS = %w[high medium low].freeze
    Result = Struct.new(:persistable, :level, :confidence, :rejection_reason, keyword_init: true)

    def self.call(level:, confidence:)
      new(level: level, confidence: confidence).call
    end

    def initialize(level:, confidence:)
      @level = level
      @confidence = confidence
    end

    def call
      parsed_level = parse_level(@level)
      if parsed_level.nil?
        return Result.new(persistable: false, level: nil, confidence: nil, rejection_reason: 'invalid_level')
      end

      parsed_confidence = parse_confidence(@confidence)
      if parsed_confidence.nil?
        return Result.new(
          persistable: false,
          level: parsed_level,
          confidence: nil,
          rejection_reason: 'invalid_confidence'
        )
      end

      Result.new(
        persistable: true,
        level: parsed_level,
        confidence: parsed_confidence,
        rejection_reason: nil
      )
    end

    private

    def parse_level(value)
      case value
      when Integer
        number = value
      when Float
        return nil unless value.finite? && (value % 1).zero?

        number = value.to_i
      when String
        stripped = value.strip
        return nil if stripped.empty?
        return nil unless stripped.match?(/\AL[1-5]\z/i) || stripped.match?(/\A[1-5]\z/)

        number = stripped.sub(/\AL/i, '').to_i
      else
        return nil
      end

      return nil unless (1..5).cover?(number)

      number
    end

    def parse_confidence(value)
      return nil unless value.is_a?(String)

      normalized = value.strip.downcase
      return nil unless CONFIDENCE_LEVELS.include?(normalized)

      normalized
    end
  end
end
