# frozen_string_literal: true

# Signs requests the way a real login does: a token that names the user's
# role and the organization's scheme.
module AuthHelper
  def auth_headers(organization, role: 'admin')
    token = JsonWebToken.encode({ user_id: 1, role: role, scheme: organization.scheme })
    { 'Authorization' => "Bearer #{token}" }
  end
end

RSpec.configure do |config|
  config.include AuthHelper, type: :request
end
