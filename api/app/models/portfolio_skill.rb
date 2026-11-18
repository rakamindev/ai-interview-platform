# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }
  validates :competency_summary, presence: true, if: :is_assessed?

  scope :assessed,   -> { where(is_assessed: true) }
  scope :unassessed, -> { where(is_assessed: false) }

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end

  def assessed?
    is_assessed? && ai_level.present?
  end

  def overridden?
    assessor_override.present?
  end

  def effective_level
    assessor_override ? assessor_override.override_level : ai_level
  end
end
