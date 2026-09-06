# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  delegate :tenant_id, to: :portfolio, allow_nil: true

  validates :skill_comparisons, presence: true
end
