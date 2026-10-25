# frozen_string_literal: true

module AuthHelper
  def auth_headers(user_id: 1, role: 'assessor', scheme: 'demo')
    token = JsonWebToken.encode(
      user_id: user_id,
      role: role,
      scheme: scheme
    )
    {
      'Authorization' => "Bearer #{token}",
      'X-Tenant-Scheme' => scheme,
      'Content-Type' => 'application/json',
      'Accept' => 'application/json'
    }
  end
end
