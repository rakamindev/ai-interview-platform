# frozen_string_literal: true

module TestHelpers
  def create_organization(attrs = {})
    Organization.create!({
      name: "Test Corp",
      scheme: "test-corp-#{SecureRandom.hex(4)}",
      identifier: "test-corp",
      host: "testcorp-#{SecureRandom.hex(4)}.example.com",
      config: {}
    }.merge(attrs))
  end

  def create_user(org = nil, attrs = {})
    User.create!({
      email: "assessor-#{SecureRandom.hex(4)}@example.com",
      password: "password123",
      password_confirmation: "password123",
      role: "admin"
    }.merge(attrs))
  end

  def auth_headers(org, user = nil)
    user ||= create_user(org)
    payload = {
      user_id: user.id,
      email: user.email,
      role: user.role,
      roles: [user.role],
      scheme: org.scheme
    }
    token = JsonWebToken.encode(payload)
    {
      'Authorization' => "Bearer #{token}",
      'X-Tenant-Scheme' => org.scheme,
      'Content-Type' => 'application/json'
    }
  end
end

RSpec.configure do |config|
  config.include TestHelpers
end
