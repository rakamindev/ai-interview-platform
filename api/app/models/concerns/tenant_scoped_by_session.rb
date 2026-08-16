# frozen_string_literal: true

# Scopes lookups to the current tenant by traversing to the owning session.
#
# Portfolio, PortfolioSkill, and FitGapReport have no tenant_id column — their
# tenant is implicitly the tenant of the session they belong to. Every public
# entry point that resolves one of these records must go through `for_tenant`,
# otherwise an authenticated assessor can read/override/export another tenant's
# candidate data by guessing a record id (cross-tenant IDOR).
#
# Example:
#   class Portfolio < ApplicationRecord
#     include TenantScopedBySession
#     tenant_scoped_by :session
#   end
#
#   class PortfolioSkill < ApplicationRecord
#     include TenantScopedBySession
#     tenant_scoped_by portfolio: :session
#   end
module TenantScopedBySession
  extend ActiveSupport::Concern

  class_methods do
    # Declares the association path from this model to its owning session.
    # The generated `for_tenant` scope restricts lookups to the given tenant.
    def tenant_scoped_by(association_path)
      scope :for_tenant, lambda { |tenant_id|
        joins(association_path).where(sessions: { tenant_id: tenant_id })
      }
    end
  end
end
