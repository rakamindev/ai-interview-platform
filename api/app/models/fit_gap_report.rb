# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze
  GENERATION_STATUSES = %w[pending generating complete failed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  # A vacancy with zero skills is valid and yields an empty comparison table —
  # the UI shows a friendly empty state instead of crashing.
  validates :generation_status, inclusion: { in: GENERATION_STATUSES }

  scope :complete,   -> { where(generation_status: 'complete') }
  scope :generating, -> { where(generation_status: %w[pending generating]) }

  def complete?   = generation_status == 'complete'
  def generating? = %w[pending generating].include?(generation_status)
  def failed?     = generation_status == 'failed'
end