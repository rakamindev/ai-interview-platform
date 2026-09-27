# frozen_string_literal: true

module RequestSpecHelper
  def authenticated_headers(user, scheme: 'test-corp')
    token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: scheme })
    {
      'Authorization' => "Bearer #{token}",
      'X-Tenant-Scheme' => scheme,
      'Content-Type' => 'application/json',
      'Accept' => 'application/json'
    }
  end

  def json_body
    JSON.parse(response.body).deep_symbolize_keys
  end
end

RSpec.configure do |config|
  config.include RequestSpecHelper, type: :request
end
