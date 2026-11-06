# frozen_string_literal: true

# Auth helpers for request specs.
# The API trusts JWT claims (no user lookup) and resolves the tenant from
# the `scheme` claim, so a matching organisation and token are enough.
module AuthHelpers
  TEST_SCHEME = 'test-corp'

  def test_organization
    @test_organization ||= Organization.find_by(scheme: TEST_SCHEME) ||
                           Organization.create!(
                             name:       'Test Corp',
                             scheme:     TEST_SCHEME,
                             identifier: TEST_SCHEME,
                             host:       'localhost'
                           )
  end

  def auth_headers(role: 'admin', user_id: 1, scheme: TEST_SCHEME)
    test_organization if scheme == TEST_SCHEME
    token = JsonWebToken.encode({ user_id: user_id, role: role, scheme: scheme })
    { 'Authorization' => "Bearer #{token}" }
  end

  # Runs the block with a current tenant so records can be created directly
  # (TenantScoped models take tenant_id from Current.tenant_id).
  def with_tenant(organization = test_organization, &block)
    Current.using(organization: organization, tenant_id: organization.id, &block)
  end
end
