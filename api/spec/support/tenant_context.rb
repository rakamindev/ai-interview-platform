# frozen_string_literal: true

# Shared tenant/auth helpers. Every AI-interview table carries a tenant_id; the
# TenantScoped concern reads Current.tenant_id (RequestStore) at create time, so
# specs must establish a tenant before creating scoped records, and request
# specs must create an Organization row for the TenantResolverMiddleware.
module TenantContext
  TEST_ORG_FIXTURE = {
    name:       'Test Corp',
    scheme:     'test-corp',
    identifier: 'test-corp',
    host:       'localhost',
    alias_hosts: [],
    config:      {}
  }.freeze

  # Convenience: establish the default test tenant for the duration of an example.
  def establish_test_tenant!(&block)
    RequestStore.store[:tenant_id] = 1
    Current.tenant_id = 1
    block ? Current.using(tenant_id: 1, &block) : Current.tenant_id
  end

  # Create the shared organizations row that TenantResolverMiddleware / public
  # tenant resolution depends on. Id 1 keeps Current.tenant_id == org.id == 1.
  def create_test_organization!
    Organization.create!(
      id:         1,
      name:       TEST_ORG_FIXTURE[:name],
      scheme:     TEST_ORG_FIXTURE[:scheme],
      identifier: TEST_ORG_FIXTURE[:identifier],
      host:       TEST_ORG_FIXTURE[:host],
      alias_hosts: TEST_ORG_FIXTURE[:alias_hosts],
      config:     TEST_ORG_FIXTURE[:config]
    )
    Current.organization = Organization.find(1)
    Current.tenant_id    = 1
    RequestStore.store[:tenant_id] = 1
  end

  def auth_headers_for(user_id: 1, role: 'admin', scheme: 'test-corp')
    { 'Authorization' => "Bearer #{JsonWebToken.encode({ user_id:, role:, scheme: })}" }
  end
end

RSpec.configure do |config|
  config.include TenantContext

  config.before(:each) do
    RequestStore.store[:tenant_id] = 1
  end
end