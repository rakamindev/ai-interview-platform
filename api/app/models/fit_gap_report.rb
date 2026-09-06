# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  include TenantScoped

  FIT_RESULTS = %w[match gap exceed not_assessed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  before_validation :assign_tenant_from_associations, on: :create

  validates :skill_comparisons, presence: true

  private

  def assign_tenant_from_associations
    self.tenant_id ||= portfolio&.tenant_id || vacancy&.tenant_id
  end
end
