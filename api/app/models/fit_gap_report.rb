# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  include TenantScoped

  FIT_RESULTS = %w[match gap exceed not_assessed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  validates :skill_comparisons, presence: true

  private

  # See Portfolio#assign_tenant_id — must be `=`, not `||=`, because Rails
  # pre-populates tenant_id from the active default_scope before this runs.
  def assign_tenant_id
    self.tenant_id = portfolio&.tenant_id
  end
end
