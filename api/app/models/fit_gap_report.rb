# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  validate :comparisons_are_an_array

  private

  def comparisons_are_an_array
    errors.add(:skill_comparisons, 'must be an array') unless skill_comparisons.is_a?(Array)
  end
end
