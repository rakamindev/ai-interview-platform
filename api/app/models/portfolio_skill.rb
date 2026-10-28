# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS   = %w[high medium low].freeze
  ASSESSMENT_STATUSES = %w[assessed not_assessed].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  validates :assessment_status, inclusion: { in: ASSESSMENT_STATUSES }
  validates :competency_summary, presence: true

  with_options if: :assessed? do
    validates :ai_level, numericality: { only_integer: true, in: 1..5 }
    validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }
  end
  validates :ai_level, absence: true, unless: :assessed?

  scope :for_tenant, ->(tenant_id) { joins(portfolio: :session).where(sessions: { tenant_id: }) }

  def assessed? = assessment_status == 'assessed'

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end

  # The level the rest of the product should use: the assessor's if they set
  # one, otherwise the AI's. nil when nobody has rated the skill.
  def effective_level
    assessor_override&.override_level || ai_level
  end
end
