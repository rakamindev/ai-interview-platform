# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze
  GENERATION_STATUSES = %w[pending generating complete failed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }
  validate :skill_comparisons_present_when_complete

  def pending? = generation_status == 'pending'
  def generating? = generation_status == 'generating'
  def complete? = generation_status == 'complete'
  def failed? = generation_status == 'failed'

  private

  def skill_comparisons_present_when_complete
    return unless complete? && skill_comparisons.blank?

    errors.add(:skill_comparisons, "can't be blank when generation is complete")
  end
end
