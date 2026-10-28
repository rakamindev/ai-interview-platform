# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  GENERATION_STATUSES = %w[queued generating complete failed stale].freeze
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }
  validate :skill_comparisons_must_be_an_array

  def complete? = generation_status == "complete"
  def generating? = %w[queued generating].include?(generation_status)
  def failed? = generation_status == "failed"
  def stale? = generation_status == "stale"

  private

  def skill_comparisons_must_be_an_array
    return if skill_comparisons.is_a?(Array)

    errors.add(:skill_comparisons, "must be an array")
  end
end
