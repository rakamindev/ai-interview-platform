# frozen_string_literal: true

# Builds bearer tokens the same way the platform does, so request specs go
# through the real TenantResolver + AuthorizeApiRequest middleware.
module AuthHelpers
  def auth_headers(scheme:, user_id: 1, role: 'admin')
    token = JsonWebToken.encode({ user_id: user_id, role: role, scheme: scheme })
    { 'Authorization' => "Bearer #{token}" }
  end
end
