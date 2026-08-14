# frozen_string_literal: true

# Builds a real signed JWT the same way rakamin-api does, so request specs
# exercise the actual TenantResolverMiddleware + AuthorizeApiRequest flow
# instead of stubbing them.
module AuthHelper
  def auth_headers(organization:, role: "assessor", user_id: 1)
    token = JsonWebToken.encode(user_id: user_id, role: role, scheme: organization.scheme)
    { "Authorization" => "Bearer #{token}" }
  end
end

RSpec.configure do |config|
  config.include AuthHelper, type: :request
end
