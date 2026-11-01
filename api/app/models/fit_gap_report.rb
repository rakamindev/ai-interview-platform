# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  validates :skill_comparisons, presence: true

  # Reports persisted before the F3 fix stored the vacancy's expectation under
  # `expected_level`; newer ones use `required_level` (the name the frontend and
  # PDF export read). Rather than rewriting persisted JSON in place, readers go
  # through this method so both shapes keep working: it is a pure read-time
  # translation, so there is no data migration to run or roll back, and legacy
  # rows are healed naturally the next time a report is regenerated.
  def normalized_skill_comparisons
    Array(skill_comparisons).map do |comparison|
      next comparison unless comparison.is_a?(Hash)

      normalized = comparison.stringify_keys
      legacy_value = normalized.delete('expected_level')
      normalized['required_level'] = legacy_value if normalized['required_level'].nil?
      normalized
    end
  end
end
