# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze
  # assessed:     rated by the model, backed by coverage
  # not_assessed: never discussed in the interview, so it has no level (shown as "Not assessed")
  # needs_review: discussed, but the model output for it could not be trusted
  ASSESSMENT_STATUSES = %w[assessed not_assessed needs_review].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  # See Portfolio.in_current_tenant.
  scope :in_current_tenant, -> { joins(portfolio: :session) }

  validates :skill_label, presence: true
  validates :assessment_status, inclusion: { in: ASSESSMENT_STATUSES }
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, if: :assessed?
  validates :ai_level, absence: true, unless: :assessed?
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }, if: :assessed?
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }, allow_nil: true, unless: :assessed?

  def assessed? = assessment_status == 'assessed'

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end
end
