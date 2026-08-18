# frozen_string_literal: true

# JWT helpers for request specs — mirrors how rakamin-api issues tokens that
# this service trusts (see app/lib/json_web_token.rb, app/auth/authorize_api_request.rb).
module RequestSpecHelpers
  def auth_headers(user_id: 1, role: 'admin', scheme: 'test-corp')
    token = JsonWebToken.encode(user_id:, role:, scheme:)
    { 'Authorization' => "Bearer #{token}" }
  end
end
