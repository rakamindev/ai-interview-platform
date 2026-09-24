# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  validates :assessment_status, inclusion: { in: %w[assessed not_assessed] }
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, if: :assessed?
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }, if: :assessed?
  validates :ai_level, :ai_confidence, absence: true, unless: :assessed?
  validates :competency_summary, presence: true, if: :assessed?

  scope :for_tenant, lambda { |tenant_id|
    joins(portfolio: :session).where(sessions: { tenant_id: tenant_id })
  }

  def assessed? = assessment_status == 'assessed'
  def not_assessed? = assessment_status == 'not_assessed'

  def evidence_quotes
    Array(evidence).map { |item| item.is_a?(Hash) ? item['quote'] || item[:quote] : item }
  end
end
