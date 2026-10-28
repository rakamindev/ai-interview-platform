# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  # `presence: true` would reject `[]` (Array#blank? is true for an empty
  # array), which is exactly the valid, non-error state for a vacancy with
  # no skills configured yet — only nil is actually invalid here.
  validate :skill_comparisons_not_nil

  private

  def skill_comparisons_not_nil
    errors.add(:skill_comparisons, "can't be nil") if skill_comparisons.nil?
  end
end
