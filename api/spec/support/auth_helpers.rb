# frozen_string_literal: true

# Builds Authorization headers with a signed JWT for assessor-facing endpoints.
# The JWT `scheme` claim is what TenantResolverMiddleware uses to resolve the
# tenant, so specs must pass the scheme of the organization they act as.
module AuthHelpers
  def auth_headers(user_id:, role: 'admin', scheme: nil)
    payload = { user_id: user_id, role: role }
    payload[:scheme] = scheme if scheme.present?

    { 'Authorization' => "Bearer #{JsonWebToken.encode(payload)}" }
  end
end

RSpec.configure do |config|
  config.include AuthHelpers, type: :request
end
