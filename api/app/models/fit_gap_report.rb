# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  STATUSES          = %w[not_requested generating complete failed].freeze
  NARRATIVE_SOURCES = %w[ai legacy_fallback].freeze

  # skill_comparisons is the snapshot a narrative was based on; it is empty
  # until a narrative has been generated (comparisons are computed on read).
  validates :status, inclusion: { in: STATUSES }
  validates :narrative_source, inclusion: { in: NARRATIVE_SOURCES }, allow_nil: true
end
