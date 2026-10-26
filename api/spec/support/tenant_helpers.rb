# frozen_string_literal: true

# Helpers for multi-tenant specs. Organizations live in public.organizations and
# are resolved from the JWT `scheme` claim by TenantResolverMiddleware.
module TenantHelpers
  def create_organization(scheme)
    Organization.find_by(scheme:) || Organization.create!(
      name: scheme.titleize, scheme:, identifier: scheme, host: "#{scheme}.test"
    )
  end

  # Runs the block as if inside a request for the given tenant, so that
  # TenantScoped models assign and filter by that tenant.
  def as_tenant(organization)
    previous = RequestStore.store.dup
    RequestStore.store[:tenant_id] = organization.id
    RequestStore.store[:organization] = organization
    yield
  ensure
    RequestStore.store.replace(previous)
  end

  def auth_headers(organization, role: 'admin', user_id: 1)
    token = JsonWebToken.encode({ user_id:, role:, scheme: organization.scheme })
    { 'Authorization' => "Bearer #{token}", 'Content-Type' => 'application/json' }
  end
end

RSpec.configure do |config|
  config.include TenantHelpers
end
