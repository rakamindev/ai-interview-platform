# frozen_string_literal: true

# Sets a per-test tenant on RequestStore so TenantScoped models
# (Assessment, Session, Vacancy, ...) are created/found under that tenant.
#
# The TenantResolverMiddleware normally populates RequestStore during a real
# request; in unit specs we must prime it manually so default_scope returns the
# records we just created.
module TenantHelper
  DEFAULT_TENANT_ID = 10_001

  def ensure_tenant(tenant_id = DEFAULT_TENANT_ID)
    RequestStore.store[:tenant_id] = tenant_id
    yield
  ensure
    RequestStore.store.delete(:tenant_id)
  end
end