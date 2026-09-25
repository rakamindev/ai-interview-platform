# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  include TenantScoped

  FIT_RESULTS = %w[match gap exceed not_assessed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  validates :skill_comparisons, presence: true

  private

  def assign_tenant_id
    self.tenant_id ||= (Current.tenant_id rescue nil) || portfolio&.tenant_id || vacancy&.tenant_id
  end
end
