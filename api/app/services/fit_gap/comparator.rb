# frozen_string_literal: true

module FitGap
  # Pure, deterministic comparison of a candidate's skill ratings against a
  # vacancy's expected levels. No IO, no model calls: everything a hiring
  # decision leans on is computed here and is fully unit-testable.
  #
  # Rules (see assessment/03-strategy.md, AC1–AC7):
  #   * A skill the interview never probed is `not_assessed`, never a gap.
  #   * A missing/corrupt rating is `not_assessed` (reason: invalid_rating).
  #   * An assessor override wins over the AI level and is marked as such.
  #   * Low/unknown AI confidence still yields a result, but the row is
  #     flagged `needs_verification` unless a human has overridden it.
  class Comparator
    LEVELS = (1..5).freeze
    CONFIDENCES = %w[high medium low].freeze
    TRUSTED_CONFIDENCES = %w[high medium].freeze
    RESULTS = %w[match gap exceed not_assessed].freeze

    Requirement = Struct.new(:skill_id, :skill_label, :expected_level, keyword_init: true)
    Rating = Struct.new(:skill_id, :skill_label, :ai_level, :ai_confidence,
                        :override_level, :assessor_notes, keyword_init: true)
    Result = Struct.new(:comparisons, :summary, keyword_init: true)

    def self.normalize_label(label)
      label.to_s.unicode_normalize(:nfc).downcase.gsub(/[[:punct:][:space:]]+/, ' ').strip
    end

    def self.valid_level?(value)
      value.is_a?(Integer) && LEVELS.cover?(value)
    end

    def initialize(requirements:, ratings:)
      @requirements = requirements
      @ratings = ratings
    end

    def call
      comparisons = @requirements.map { |requirement| compare(requirement) }
      Result.new(comparisons:, summary: summarize(comparisons))
    end

    private

    def compare(requirement)
      rating = find_rating(requirement)
      row = base_row(requirement, rating)

      return not_assessed(row, 'invalid_expectation') unless self.class.valid_level?(requirement.expected_level)
      return not_assessed(row, 'not_probed') if rating.nil?

      candidate_level = row[:candidate_level]
      return not_assessed(row, 'invalid_rating') unless self.class.valid_level?(candidate_level)

      delta = candidate_level - requirement.expected_level
      row.merge(result: classify(delta), delta:)
    end

    def base_row(requirement, rating)
      override = rating && self.class.valid_level?(rating.override_level)
      confidence = normalize_confidence(rating&.ai_confidence)

      {
        skill_label: requirement.skill_label,
        skill_id: requirement.skill_id,
        expected_level: requirement.expected_level,
        candidate_level: override ? rating.override_level : rating&.ai_level,
        ai_level: self.class.valid_level?(rating&.ai_level) ? rating.ai_level : nil,
        is_override: override ? true : false,
        assessor_notes: override ? rating.assessor_notes : nil,
        confidence:,
        needs_verification: rating.present? && !override && TRUSTED_CONFIDENCES.exclude?(confidence),
        result: nil,
        delta: nil,
        not_assessed_reason: nil
      }
    end

    def not_assessed(row, reason)
      row.merge(result: 'not_assessed', candidate_level: nil, delta: nil,
                needs_verification: false, not_assessed_reason: reason)
    end

    def classify(delta)
      return 'match' if delta.zero?

      delta.positive? ? 'exceed' : 'gap'
    end

    def normalize_confidence(value)
      normalized = value.to_s.strip.downcase
      CONFIDENCES.include?(normalized) ? normalized : nil
    end

    def find_rating(requirement)
      if requirement.skill_id.present?
        by_id = @ratings.find { |r| r.skill_id.present? && r.skill_id == requirement.skill_id }
        return by_id if by_id
      end

      key = self.class.normalize_label(requirement.skill_label)
      @ratings.find { |r| self.class.normalize_label(r.skill_label) == key }
    end

    def summarize(comparisons)
      counts = RESULTS.to_h { |result| [result.to_sym, comparisons.count { |c| c[:result] == result }] }
      { total: comparisons.size, **counts, needs_verification: comparisons.count { |c| c[:needs_verification] } }
    end
  end
end
