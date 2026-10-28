# frozen_string_literal: true

module RequestSpecHelper
  def auth_headers_for(user_id: 1, role: 'admin', organization: nil)
    org = organization || create(:organization)
    token = JsonWebToken.encode(user_id: user_id, role: role, scheme: org.scheme)
    {
      'Authorization' => "Bearer #{token}",
      'X-Tenant-Scheme' => org.scheme,
      'Content-Type' => 'application/json',
      'Accept' => 'application/json'
    }
  end

  def json_response
    JSON.parse(response.body)
  end
end

RSpec.configure do |config|
  config.include RequestSpecHelper, type: :request
end
