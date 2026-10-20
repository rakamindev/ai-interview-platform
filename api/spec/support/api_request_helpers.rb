# frozen_string_literal: true

module ApiRequestHelpers
  def assessor_headers(organization, role: 'admin')
    token = JsonWebToken.encode(
      user_id: 7_001,
      role:,
      scheme: organization.scheme
    )

    {
      'Authorization' => "Bearer #{token}",
      'X-Tenant-Scheme' => organization.scheme,
      'CONTENT_TYPE' => 'application/json'
    }
  end
end

RSpec.configure do |config|
  config.include ApiRequestHelpers, type: :request
end
