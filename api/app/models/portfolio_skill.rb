# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  include TenantScopedThrough

  CONFIDENCE_LEVELS = %w[high medium low].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  tenant_scoped_through(portfolio: :session)

  validates :skill_label, presence: true
  # ai_level is nullable: a skill the interview never reached has no level,
  # and recording one anyway is what made unassessed skills read as weak.
  # See migration 20260819000000.
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }
  validates :competency_summary, presence: true

  scope :assessed,   -> { where.not(ai_level: nil) }
  scope :unassessed, -> { where(ai_level: nil) }

  # Did the interview produce enough evidence to place this skill at all?
  def assessed? = ai_level.present?

  # The level a human would act on: the assessor's correction when there is
  # one, otherwise the model's. nil when the skill was never assessed and no
  # assessor has supplied a judgement.
  def effective_level
    assessor_override&.override_level || ai_level
  end

  def overridden? = assessor_override.present?

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end
end
