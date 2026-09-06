# frozen_string_literal: true

module AuthHelpers
  # Generate auth header for a user + org scheme
  def auth_headers_for(user_id:, role: 'admin', scheme:)
    token = JsonWebToken.encode(user_id: user_id, role: role, scheme: scheme)
    {
      'Authorization' => "Bearer #{token}",
      'Content-Type'  => 'application/json'
    }
  end

  # Shortcut: admin from specified scheme
  def assessor_headers(user_id: 1, scheme: 'test-corp')
    auth_headers_for(user_id: user_id, role: 'admin', scheme: scheme)
  end
end
