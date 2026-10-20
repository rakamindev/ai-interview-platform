# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  # A NULL level means "not assessed": the interview produced no evidence for this skill.
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }, allow_nil: true
  validates :competency_summary, presence: true, if: :assessed?
  validate :level_and_confidence_set_together

  def assessed?
    !ai_level.nil?
  end

  # The level the hiring team should see: the assessor's override wins over the AI.
  def effective_level
    assessor_override&.override_level || ai_level
  end

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end

  private

  def level_and_confidence_set_together
    return if ai_level.nil? == ai_confidence.nil?

    errors.add(:base, 'level and confidence must both be set, or both be empty (not assessed)')
  end
end
