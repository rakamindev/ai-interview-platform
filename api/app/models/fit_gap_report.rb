# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze
  GENERATION_STATUSES = %w[pending generating complete failed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  validates :skill_comparisons, presence: true, if: :complete?
  validates :generation_status, inclusion: { in: GENERATION_STATUSES }

  def pending? = generation_status == "pending"
  def generating? = generation_status == "generating"
  def complete? = generation_status == "complete"
  def failed? = generation_status == "failed"
end
