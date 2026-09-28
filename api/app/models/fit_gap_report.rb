# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze
  NARRATIVE_SOURCES = %w[ai rule_based_fallback].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  validates :skill_comparisons, presence: true
  validates :narrative_source, inclusion: { in: NARRATIVE_SOURCES }
end
