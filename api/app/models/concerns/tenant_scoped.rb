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
    # Default scope: filter by current tenant
    default_scope do
      if RequestStore.store.key?(:tenant_id)
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
