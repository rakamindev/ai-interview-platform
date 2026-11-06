# frozen_string_literal: true

module AuthHelpers
  # Mirrors the production token shape: the tenant comes from the `scheme`
  # claim, which TenantResolverMiddleware turns into Current.tenant_id.
  def auth_headers(user, organization)
    token = JsonWebToken.encode(
      user_id: user.id,
      role: user.role,
      scheme: organization.scheme
    )
    { 'Authorization' => "Bearer #{token}" }
  end

  def json_body
    JSON.parse(response.body)
  end
end

RSpec.configure do |config|
  config.include AuthHelpers, type: :request
end
