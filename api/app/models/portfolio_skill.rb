# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  # nil ai_level is legitimate: it means "the AI never produced a usable level"
  # (see Portfolios::LevelParser). The UI renders it as "Unknown", never as the
  # worst rating. Values that ARE present must still be a real level.
  validates :ai_level, numericality: { only_integer: true, in: 1..5, allow_nil: true }
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }
  validates :competency_summary, presence: true

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end
end
