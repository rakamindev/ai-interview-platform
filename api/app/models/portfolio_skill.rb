# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze
  ASSESSMENT_STATUSES = %w[assessed insufficient_evidence not_assessed].freeze
  STATUS_REASONS = %w[not_covered no_valid_evidence missing_from_model_output invalid_model_output].freeze

  belongs_to :portfolio
  has_one :session, through: :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  validates :assessment_status, inclusion: { in: ASSESSMENT_STATUSES }
  validates :status_reason, inclusion: { in: STATUS_REASONS }, allow_nil: true

  with_options if: :not_assessed? do
    validates :ai_level, absence: true
    validates :status_reason, presence: true
  end

  with_options unless: :not_assessed? do
    validates :ai_level, presence: true, numericality: { only_integer: true, in: 1..5 }
    validates :ai_confidence, presence: true, inclusion: { in: CONFIDENCE_LEVELS }
    validates :competency_summary, presence: true
  end

  scope :for_current_tenant, -> { joins(portfolio: :session).where(sessions: { tenant_id: Current.tenant_id }) }

  def assessed?              = assessment_status == 'assessed'
  def insufficient_evidence? = assessment_status == 'insufficient_evidence'
  def not_assessed?          = assessment_status == 'not_assessed'
  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end
end
