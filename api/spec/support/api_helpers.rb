# frozen_string_literal: true

# Helpers for request specs: auth header generation for a given tenant/role.
module ApiHelpers
  def auth_header_for(role: 'admin', user_id: 1, scheme: 'test-corp')
    token = JsonWebToken.encode({ user_id:, role:, scheme: })
    { 'Authorization' => "Bearer #{token}" }
  end
end