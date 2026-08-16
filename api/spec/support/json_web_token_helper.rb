# frozen_string_literal: true

# Mints real, signature-valid JWTs for request specs, exactly as the
# authentication flow does in production.
module JsonWebTokenHelper
  def auth_header_for(organization:, role: 'admin', user_id: 1)
    token = JsonWebToken.encode(
      { user_id: user_id, role: role, scheme: organization.scheme }
    )
    { 'Authorization' => "Bearer #{token}" }
  end
end

RSpec.configure do |config|
  config.include JsonWebTokenHelper, type: :request
end
