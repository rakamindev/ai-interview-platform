# frozen_string_literal: true

module AuthHelpers
  def auth_headers_for(organization, role: 'admin', user_id: 1)
    token = JsonWebToken.encode({ user_id:, role:, scheme: organization.scheme }, 1.hour)
    { 'Authorization' => "Bearer #{token}", 'Content-Type' => 'application/json' }
  end
end
