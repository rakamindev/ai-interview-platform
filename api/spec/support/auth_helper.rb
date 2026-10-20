# frozen_string_literal: true

module AuthHelper
  def auth_headers_for(user:, organization:)
    token = JsonWebToken.encode(
      user_id: user.id,
      role:    user.role,
      scheme:  organization.scheme
    )
    {
      'Authorization' => "Bearer #{token}",
      'X-Tenant-Scheme' => organization.scheme
    }
  end
end

RSpec.configure do |config|
  config.include AuthHelper, type: :request
end
