# frozen_string_literal: true

# TenantResolverMiddleware resolves the tenant from the JWT `scheme` claim, so a
# request spec's tenant identity and its auth identity travel in the same token.
# Getting a cross-tenant spec right therefore means minting a token whose scheme
# points at the *other* organization.
module AuthHelpers
  def jwt_for(organization, user_id: 1, role: 'admin')
    JsonWebToken.encode(user_id: user_id, role: role, scheme: organization.scheme)
  end

  def auth_headers(organization, user_id: 1, role: 'admin')
    {
      'Authorization' => "Bearer #{jwt_for(organization, user_id: user_id, role: role)}",
      'Content-Type'  => 'application/json'
    }
  end
end

RSpec.configure do |config|
  config.include AuthHelpers, type: :request

  # Rack::Attack is backed by a Redis cache store. Request specs all originate
  # from 127.0.0.1, so throttles would fire across examples and make failures
  # depend on execution order. Disable it here and test it separately if needed.
  config.before(:suite) { Rack::Attack.enabled = false if defined?(Rack::Attack) }
end
