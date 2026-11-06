# frozen_string_literal: true

# Helper autentikasi untuk request spec.
# API mempercayai klaim JWT (tanpa lookup user ke DB) dan me-resolve tenant
# dari klaim `scheme`, jadi tes cukup membuat organisasi + token yang cocok.
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

  # Menjalankan blok dengan tenant aktif, untuk membuat data langsung di DB
  # (model dengan TenantScoped mengisi tenant_id dari Current.tenant_id).
  def with_tenant(organization = test_organization, &block)
    Current.using(organization: organization, tenant_id: organization.id, &block)
  end
end
