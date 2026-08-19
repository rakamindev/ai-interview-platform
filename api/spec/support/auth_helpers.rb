# frozen_string_literal: true

# Helpers for request specs: mint a valid Bearer token that the real
# auth middleware/AuthorizeApiRequest will accept (same SECRET_KEY_BASE
# the app decodes with — no stubbing of the auth path).
module AuthHelpers
  def auth_headers(scheme:, role: 'admin', user: nil, user_id: nil)
    token = JsonWebToken.encode(
      user_id: user_id || user&.id || 1,
      role: role,
      scheme: scheme,
    )
    { 'Authorization' => "Bearer #{token}" }
  end
end
