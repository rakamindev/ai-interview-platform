# frozen_string_literal: true

# Builds request headers for an authenticated, tenant-scoped request spec.
#
# Tenant resolution (TenantResolverMiddleware) uses `decode_without_verification`
# and reads the `scheme` claim — from the JWT if present, else the X-Tenant-Scheme
# header. Auth (AuthTokenMiddleware) verifies the JWT signature via JsonWebToken.decode.
# Sending both headers keeps both middlewares happy regardless of decode path.
module AuthHelpers
  def auth_headers(user_id:, role: 'assessor', scheme:)
    token = JsonWebToken.encode(user_id: user_id, role: role, scheme: scheme)

    {
      'Authorization' => "Bearer #{token}",
      'X-Tenant-Scheme' => scheme
    }
  end
end

RSpec.configure do |config|
  config.include AuthHelpers, type: :request
end
