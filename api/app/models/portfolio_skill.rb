# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  # nil means the interview never reached this skill. It is not a zero and it is
  # not an L1; it is the absence of a reading, and it has to survive as one.
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, allow_nil: true

  def assessed? = ai_level.present?
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }
  validates :competency_summary, presence: true

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end
end
