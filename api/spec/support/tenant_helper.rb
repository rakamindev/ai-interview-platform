# frozen_string_literal: true

# Runs a block with Current.tenant_id set, the way a real request does via
# TenantResolverMiddleware. Needed because TenantScoped's default_scope is a
# no-op unless RequestStore has a :tenant_id key (see app/models/concerns/
# tenant_scoped.rb) — without this, factories building tenant-scoped records
# outside a real request would silently skip the scoping behavior under test.
module TenantHelper
  def with_tenant(tenant_id)
    Current.using(tenant_id: tenant_id) { yield }
  end
end
