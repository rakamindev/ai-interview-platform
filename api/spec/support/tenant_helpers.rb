# frozen_string_literal: true

module TenantHelpers
  # Creates an organization row in public.organizations (read-only model in app code).
  def create_organization(scheme:)
    Organization.create!(name: scheme.titleize, scheme:, identifier: scheme, host: "#{scheme}.test")
  end

  # Runs the block as if a request for this organization were in flight, which
  # is what TenantScoped default scopes and callbacks rely on.
  def as_tenant(organization)
    previous = RequestStore.store.slice(:organization, :tenant_id)
    Current.organization = organization
    Current.tenant_id = organization.id
    yield
  ensure
    RequestStore.store.delete(:organization)
    RequestStore.store.delete(:tenant_id)
    RequestStore.store.merge!(previous) if previous
  end

  def auth_headers_for(organization, role: 'admin', user_id: 1)
    token = JsonWebToken.encode({ user_id:, role:, scheme: organization.scheme })
    { 'Authorization' => "Bearer #{token}", 'Content-Type' => 'application/json' }
  end
end

RSpec.configure do |config|
  config.include TenantHelpers
end
