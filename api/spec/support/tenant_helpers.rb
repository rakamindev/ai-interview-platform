# frozen_string_literal: true

module TenantHelpers
  def create_organization(scheme)
    Organization.create!(name: scheme.titleize, scheme:, identifier: scheme, host: "#{scheme}.test")
  end

  def as_tenant(organization)
    RequestStore.store[:tenant_id] = organization.id
    Current.organization = organization
    yield
  ensure
    RequestStore.clear!
  end

  def auth_headers(organization, role: 'admin', user_id: 1)
    token = JsonWebToken.encode({ user_id:, role:, scheme: organization.scheme })
    { 'Authorization' => "Bearer #{token}" }
  end
end
