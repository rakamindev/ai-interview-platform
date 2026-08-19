# frozen_string_literal: true

# Automatically scopes all queries to the current tenant.
# Include this in every AI interview model that has a tenant_id column.
#
# Example:
#   class Assessment < ApplicationRecord
#     include TenantScoped
#   end
#
# All queries will be scoped to Current.tenant_id automatically.
# On create/update, tenant_id is set from Current.tenant_id.
module TenantScoped
  extend ActiveSupport::Concern

  included do
    # Default scope: filter by current tenant. Only applies when a tenant is
    # actually set — a mere key with a nil value must not produce
    # WHERE tenant_id IS NULL (which would silently empty every query).
    default_scope do
      tenant_id = RequestStore.store[:tenant_id]
      if tenant_id
        where(tenant_id: Current.tenant_id)
      else
        all
      end
    end

    # Set tenant_id before validation on create
    before_validation :assign_tenant_id, on: :create

    validates :tenant_id, presence: true
  end

  private

  def assign_tenant_id
    self.tenant_id ||= Current.tenant_id
  end
end
