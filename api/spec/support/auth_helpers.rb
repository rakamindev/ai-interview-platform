# frozen_string_literal: true

module AuthHelpers
  # Headers an assessor's browser would send for the given organization.
  def auth_headers(organization, role: 'admin', user_id: 1)
    token = JsonWebToken.encode({ user_id: user_id, role: role, scheme: organization.scheme })
    { 'Authorization' => "Bearer #{token}", 'Content-Type' => 'application/json' }
  end
end

RSpec.configure do |config|
  config.include AuthHelpers, type: :request
end
