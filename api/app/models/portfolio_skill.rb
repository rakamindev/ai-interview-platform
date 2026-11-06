# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze

  belongs_to :portfolio
  belongs_to :generation, class_name: 'PortfolioGeneration', optional: true, inverse_of: :portfolio_skills
  has_one :assessor_override, dependent: :destroy

  # See Portfolio.visible_to_current_tenant.
  scope :visible_to_current_tenant, -> { where(portfolio_id: Portfolio.visible_to_current_tenant.select(:id)) }

  validates :skill_label, presence: true
  # nil = Not rated (see ai_level_reason); never coerced to a level.
  AI_LEVEL_REASONS = %w[missing_level invalid_level ai_omitted].freeze

  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :ai_level_reason, inclusion: { in: AI_LEVEL_REASONS }, allow_nil: true
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }
  validates :competency_summary, presence: true

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end
end
