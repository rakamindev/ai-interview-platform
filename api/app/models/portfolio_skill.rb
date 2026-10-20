# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS   = %w[high medium low].freeze
  ASSESSMENT_STATUSES = %w[assessed insufficient_evidence not_assessed].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  scope :for_current_tenant, -> { where(portfolio_id: Portfolio.for_current_tenant.select(:id)) }

  validates :skill_label, presence: true
  validates :assessment_status, inclusion: { in: ASSESSMENT_STATUSES }
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, if: :assessed?
  validates :ai_level, absence: true, unless: :assessed?
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }, if: :assessed?

  def assessed? = assessment_status == 'assessed'

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end
end
