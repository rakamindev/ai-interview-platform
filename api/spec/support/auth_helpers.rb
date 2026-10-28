# frozen_string_literal: true

# Request-spec helpers for authenticating as a user of a given tenant.
#
# TenantResolverMiddleware reads the tenant from the JWT `scheme` claim, and
# AuthorizeApiRequest reads `user_id` and `role`, so a signed token is enough;
# no extra tenant header is needed.
module AuthHelpers
  def auth_headers_for(organization, role: 'admin', user_id: 1)
    token = JsonWebToken.encode({ user_id: user_id, role: role, scheme: organization.scheme })
    { 'Authorization' => "Bearer #{token}" }
  end
end
