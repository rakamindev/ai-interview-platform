# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze
  ASSESSMENT_STATES = %w[assessed not_assessed].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  validates :assessment_state, inclusion: { in: ASSESSMENT_STATES }
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }, allow_nil: true
  validates :competency_summary, presence: true
  validate :assessment_fields_match_state

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end

  private

  def assessment_fields_match_state
    if assessment_state == 'assessed' && (ai_level.nil? || ai_confidence.nil?)
      errors.add(:base, 'assessed skills require a level and confidence')
    end

    return unless assessment_state == 'not_assessed'

    errors.add(:ai_level, 'must be blank when not assessed') if ai_level.present?
    errors.add(:ai_confidence, 'must be blank when not assessed') if ai_confidence.present?
    errors.add(:evidence, 'must be empty when not assessed') if evidence_quotes.any?
    errors.add(:evidence_turn_ids, 'must be empty when not assessed') if Array(evidence_turn_ids).any?
  end
end
