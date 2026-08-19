module AuthHelpers
  def assessor_auth_headers(organization, user_id: 1, role: 'admin')
    token = JsonWebToken.encode(user_id: user_id, role: role, scheme: organization.scheme)
    { 'Authorization' => "Bearer #{token}" }
  end
end

RSpec.configure do |config|
  config.include AuthHelpers, type: :request
end
