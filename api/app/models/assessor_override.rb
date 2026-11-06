# frozen_string_literal: true

class AssessorOverride < ApplicationRecord
  belongs_to :portfolio_skill
  # first_made_on: the report on which the assessor first corrected this skill (never changes).
  # last_decided_on: the report the latest decision was made against (the screen they were looking at).
  belongs_to :first_made_on_generation, class_name: 'PortfolioGeneration', optional: true
  belongs_to :last_decided_on_generation,    class_name: 'PortfolioGeneration', optional: true

  # ai_level_changed:             the AI now rates this skill differently from what the assessor saw
  # skill_missing_in_current:     the skill is not in the current report (never re-attached by guesswork)
  # conflicting_decisions:        older data held two decisions for one skill; this newest one is active
  # superseded_by_newer_decision: an older conflicting decision, kept for the record, not active
  REVIEW_REASONS = %w[ai_level_changed skill_missing_in_current conflicting_decisions superseded_by_newer_decision].freeze

  validates :ai_level,       numericality: { only_integer: true, in: 1..5 }, allow_nil: true # nil: skill was Not rated
  validates :override_level, numericality: { only_integer: true, in: 1..5 }
  validates :overridden_by,  presence: true
  validates :review_reason,  inclusion: { in: REVIEW_REASONS }, allow_nil: true
end
