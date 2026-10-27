# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  # An empty array is valid (vacancy without skills); only a missing value is not.
  validate { errors.add(:skill_comparisons, :blank) if skill_comparisons.nil? }
end
