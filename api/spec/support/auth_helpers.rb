# frozen_string_literal: true

module AuthHelpers
  def auth_headers(user)
    token = JsonWebToken.encode(user_id: user.id, role: user.role, scheme: 'test-corp')
    { 'Authorization' => "Bearer #{token}" }
  end

  def auth_headers_for_role(role)
    user = create(:user, role: role.to_s)
    auth_headers(user)
  end

  def json_headers
    { 'Content-Type' => 'application/json' }
  end

  def auth_json_headers(user)
    auth_headers(user).merge(json_headers)
  end
end

RSpec.configure do |config|
  config.include AuthHelpers, type: :request
end
