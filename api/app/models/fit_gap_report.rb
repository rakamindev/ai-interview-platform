# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze
  RECOMMENDATION_STATUSES = %w[sufficient insufficient_evidence].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  # An empty array is a valid result (vacancy with no skills); only a missing value is not.
  validate :skill_comparisons_present
  validates :recommendation_status, inclusion: { in: RECOMMENDATION_STATUSES }, allow_nil: true

  def insufficient_evidence?
    recommendation_status == 'insufficient_evidence'
  end

  private

  def skill_comparisons_present
    errors.add(:skill_comparisons, "can't be nil") if skill_comparisons.nil?
  end
end
