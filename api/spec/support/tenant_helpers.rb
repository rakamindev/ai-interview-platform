# frozen_string_literal: true

# Helpers to run code inside a simulated tenant request context.
# Mirrors what TenantResolverMiddleware does for real HTTP requests.
module TenantHelpers
  # Executes the block with Current.tenant_id/Current.organization set.
  def with_tenant(organization)
    Current.using(organization: organization, tenant_id: organization.id) do
      yield
    end
  end

  # Shortcut: run inside a tenant context, creating the org if not provided.
  # Usage: in_tenant { ... } | in_tenant(org) { ... } | in_tenant(scheme: 'x') { ... }
  def in_tenant(org = nil, scheme: 'test-corp', name: 'Test Corp')
    org ||= create(:organization, scheme: scheme, name: name)
    with_tenant(org) { yield org }
  end
end