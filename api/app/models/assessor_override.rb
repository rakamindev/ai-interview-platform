# frozen_string_literal: true

# AssessorReview — human disposition of an AI skill evaluation.
#
# The `assessor_overrides` table is the storage for this concept (kept for
# backward compatibility with the legacy override endpoint). An override is
# now one of three review outcomes:
#
#   confirmed              — assessor agrees with the AI level (reviewed_level nil → use ai_level)
#   adjusted               — assessor supplies a different reviewed_level (1..5)
#   insufficient_evidence  — no valid level; must be re-assessed, never treated as a rating
#
# `ai_level` stores the AI's snapshot at review time; `reviewed_level` is the
# human's. `rationale` is required for `adjusted` and `insufficient_evidence`.
class AssessorOverride < ApplicationRecord
  OUTCOMES = %w[confirmed adjusted insufficient_evidence].freeze

  belongs_to :portfolio_skill

  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :override_level, numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :reviewed_level, numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :outcome, inclusion: { in: OUTCOMES }
  validates :reviewed_by, presence: true
  validates :rationale, presence: true, if: :rationale_required?

  validate :reviewed_level_required_for_adjusted
  validate :reviewed_level_forbidden_when_confirmed

  # The human's effective level for this skill:
  #   confirmed → AI level; adjusted → reviewed level; insufficient → nil
  def effective_level
    case outcome
    when 'confirmed'            then ai_level
    when 'adjusted'             then reviewed_level
    when 'insufficient_evidence' then nil
    end
  end

  def insufficient_evidence? = outcome == 'insufficient_evidence'
  def confirmed?              = outcome == 'confirmed'
  def adjusted?               = outcome == 'adjusted'

  private

  def rationale_required?
    %w[adjusted insufficient_evidence].include?(outcome)
  end

  def reviewed_level_required_for_adjusted
    errors.add(:reviewed_level, "is required when outcome is 'adjusted'") if adjusted? && reviewed_level.blank?
  end

  def reviewed_level_forbidden_when_confirmed
    errors.add(:reviewed_level, "must be blank when outcome is 'confirmed'") if confirmed? && reviewed_level.present?
  end
end
