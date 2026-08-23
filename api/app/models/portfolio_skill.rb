# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze
  STATUSES          = %w[rated not_assessed].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  validates :status, inclusion: { in: STATUSES }

  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, if: :rated?
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }, if: :rated?
  validates :competency_summary, presence: true, if: :rated?

  validates :ai_level, :ai_confidence, :competency_summary, absence: true, if: :not_assessed?

  def rated?         = status == "rated"
  def not_assessed?  = status == "not_assessed"

  def evidence_quotes
    Array(evidence)
  end
end
