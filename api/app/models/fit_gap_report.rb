# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze
  GENERATION_STATUSES = %w[generating complete failed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }
  # Comparisons are only guaranteed once generation completes; a pending
  # ('generating') or 'failed' row may have none yet.
  validates :skill_comparisons, presence: true, if: :complete?

  def generating? = generation_status == 'generating'
  def complete?   = generation_status == 'complete'
  def failed?     = generation_status == 'failed'
end
