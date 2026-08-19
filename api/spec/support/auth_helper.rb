# frozen_string_literal: true

module AuthHelper
  def auth_headers(user_id: 1, role: 'admin', scheme: 'test-corp')
    token = JsonWebToken.encode({ user_id: user_id, role: role, scheme: scheme })
    {
      'Authorization' => "Bearer #{token}",
      'X-Tenant-Scheme' => scheme,
      'Content-Type' => 'application/json'
    }
  end
end

RSpec.configure do |config|
  config.include AuthHelper, type: :request
end
