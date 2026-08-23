# frozen_string_literal: true

class PortfolioSkillGenerationEvent < ApplicationRecord
  include TenantScoped

  belongs_to :portfolio_skill

  EVENT_TYPES = %w[stale_marked restored].freeze

  validates :event_type, inclusion: { in: EVENT_TYPES }
  validates :reason, presence: true

  before_create :fill_tenant_from_skill

  private

  def fill_tenant_from_skill
    self.tenant_id ||= portfolio_skill&.tenant_id
  end
end
