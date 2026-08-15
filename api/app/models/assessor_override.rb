# frozen_string_literal: true

class AssessorOverride < ApplicationRecord
  include TenantScoped

  belongs_to :portfolio_skill

  validates :ai_level,       numericality: { only_integer: true, in: 1..5 }
  validates :override_level, numericality: { only_integer: true, in: 1..5 }
  validates :overridden_by,  presence: true

  private

  # See Portfolio#assign_tenant_id — must be `=`, not `||=`, because Rails
  # pre-populates tenant_id from the active default_scope before this runs.
  def assign_tenant_id
    self.tenant_id = portfolio_skill&.tenant_id
  end
end
