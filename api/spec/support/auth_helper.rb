# frozen_string_literal: true

module AuthHelper
  def authenticated_headers(user_role = 'admin', organization = nil)
    org = organization || Organization.find_by(scheme: 'test-corp') || Organization.create!(
      name: 'Test Corp',
      scheme: 'test-corp',
      identifier: 'test-corp-id',
      host: 'localhost'
    )
    token = JsonWebToken.encode({ user_id: 1, role: user_role, scheme: org.scheme })
    {
      'Authorization' => "Bearer #{token}",
      'Content-Type' => 'application/json',
      'X-Tenant-Scheme' => org.scheme
    }
  end
end

RSpec.configure do |config|
  config.include AuthHelper, type: :request
end
