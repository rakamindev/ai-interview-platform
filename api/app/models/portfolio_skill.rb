# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze

  # Why a skill has no level (Step 4, Option B). Never turn missing evidence into a score.
  NOT_ASSESSED_REASONS = %w[not_reached insufficient_evidence omitted_by_model].freeze
  NOT_ASSESSED_REASON_LABELS = {
    'not_reached'           => 'Not reached before the interview ended',
    'insufficient_evidence' => 'Not enough evidence to rate',
    'omitted_by_model'      => "Missing from the AI's output"
  }.freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  # Scoped through portfolio -> session, like Portfolio.for_current_tenant.
  scope :for_current_tenant, -> { joins(portfolio: :session).where(sessions: { tenant_id: Current.tenant_id }) }

  validates :skill_label, presence: true
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, allow_nil: true

  # A rated skill has a confidence; a skill that wasn't assessed has none, and says why.
  with_options if: :assessed? do
    validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }
    validates :not_assessed_reason, absence: true
  end
  with_options unless: :assessed? do
    validates :ai_confidence, absence: { message: 'must be empty for a skill that was not assessed' }
    validates :not_assessed_reason, inclusion: { in: NOT_ASSESSED_REASONS }
  end

  def assessed? = !ai_level.nil?

  # Derived, not stored, so it can't drift from the level.
  def assessment_status = assessed? ? 'assessed' : 'not_assessed'

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end
end
