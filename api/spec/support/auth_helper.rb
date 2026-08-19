module AuthHelper
  def auth_headers(organization, role: "admin", user_id: 1)
    token = JsonWebToken.encode(user_id: user_id, role: role, scheme: organization.scheme)
    { "Authorization" => "Bearer #{token}" }
  end
end

RSpec.configure do |config|
  config.include AuthHelper, type: :request
end
