# frozen_string_literal: true

# Append-only audit trail for assessor overrides.
# Under UU PDP Art. 10 the assessor override is what keeps a hiring rating
# out of "solely automated" territory — so an unauditable override means
# the operator cannot demonstrate a human was ever meaningfully involved.
#
# No update or destroy path — enforced by Postgres triggers.
class AssessorOverrideEvent < ApplicationRecord
  include TenantScoped

  belongs_to :portfolio_skill

  validates :ai_level,       numericality: { only_integer: true, in: 1..5 }
  validates :override_level, numericality: { only_integer: true, in: 1..5 }
  validates :overridden_by,  presence: true

  before_create :set_tenant_from_override

  private

  def set_tenant_from_override
    self.tenant_id ||= portfolio_skill&.tenant_id
  end
end
