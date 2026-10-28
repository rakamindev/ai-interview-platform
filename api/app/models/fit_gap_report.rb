# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze
  GENERATION_STATUSES = %w[pending generating complete failed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }
  validate :skill_comparisons_are_an_array

  private

  def skill_comparisons_are_an_array
    errors.add(:skill_comparisons, 'must be an array') unless skill_comparisons.is_a?(Array)
  end
end
