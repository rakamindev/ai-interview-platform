# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  include TenantScoped

  CONFIDENCE_LEVELS = %w[high medium low].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }
  validates :competency_summary, presence: true

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end

  private

  # See Portfolio#assign_tenant_id — must be `=`, not `||=`, because Rails
  # pre-populates tenant_id from the active default_scope before this runs.
  def assign_tenant_id
    self.tenant_id = portfolio&.tenant_id
  end
end
