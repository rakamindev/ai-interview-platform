# frozen_string_literal: true

# Shared helpers for request specs — mint real JWTs the same way rakamin-api
# does (JsonWebToken.encode with a `scheme` claim), so TenantResolverMiddleware
# resolves Current.tenant_id exactly as it does in production.
module RequestSpecHelpers
  def json
    JSON.parse(response.body)
  end

  def auth_headers(organization:, role: 'assessor', user_id: 1)
    token = JsonWebToken.encode(user_id: user_id, role: role, scheme: organization.scheme)
    { 'Authorization' => "Bearer #{token}" }
  end
end
