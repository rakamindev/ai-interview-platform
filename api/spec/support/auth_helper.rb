# frozen_string_literal: true

module AuthHelper
  # Mints a JWT and returns (headers, org) — org is created via factory.
  def auth_headers(role: 'admin', organization: nil)
    org = organization || create(:organization)
    token = JsonWebToken.encode({ user_id: 1, role: role, scheme: org.scheme })
    [{ 'Authorization' => "Bearer #{token}" }, org]
  end
end