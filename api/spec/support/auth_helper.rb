# frozen_string_literal: true

module AuthHelper
  def auth_headers_for(organization, role: 'assessor', user_id: 1)
    token = JsonWebToken.encode(
      user_id: user_id,
      role: role,
      scheme: organization.scheme
    )
    {
      'Authorization' => "Bearer #{token}",
      'Content-Type'  => 'application/json'
    }
  end
end
