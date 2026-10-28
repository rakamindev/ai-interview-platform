# frozen_string_literal: true

module TenantHelpers
  def create_organization(scheme)
    Organization.create!(name: scheme.titleize, scheme:, identifier: scheme, host: "#{scheme}.test")
  end

  # Runs the block as if a request for this tenant were in flight, so
  # TenantScoped default scopes and tenant assignment behave as in production.
  def as_tenant(organization)
    previous = RequestStore.store.dup
    RequestStore.store[:organization] = organization
    RequestStore.store[:tenant_id]    = organization.id
    yield
  ensure
    RequestStore.store.replace(previous)
  end

  def auth_headers(organization, user_id: 1, role: 'admin')
    token = JsonWebToken.encode({ user_id:, role:, scheme: organization.scheme })
    { 'Authorization' => "Bearer #{token}", 'Content-Type' => 'application/json' }
  end
end
