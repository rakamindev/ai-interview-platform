# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  # Owned transitively, two associations out: portfolio -> session -> tenant.
  # See the note on Portfolio.in_tenant.
  scope :in_tenant, lambda { |tenant_id|
    joins(portfolio: :session).where(sessions: { tenant_id: tenant_id })
  }

  validates :skill_label, presence: true
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }
  validates :competency_summary, presence: true

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end
end
