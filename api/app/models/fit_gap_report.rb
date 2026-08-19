# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  include TenantScoped

  FIT_RESULTS = %w[match gap exceed not_assessed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  validates :skill_comparisons, presence: true

  private

  # Same reasoning as Portfolio#assign_tenant_id: always created from
  # Sidekiq worker context, so inherit from the portfolio instead of
  # TenantScoped's default Current.tenant_id fallback.
  def assign_tenant_id
    self.tenant_id ||= portfolio&.tenant_id
  end
end
