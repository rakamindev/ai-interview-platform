module AuthHelpers
  # Builds an Organization + a matching admin JWT so request specs can hit
  # tenant-scoped, authenticated endpoints without going through the real
  # login flow. Returns the headers hash to pass to a request.
  def assessor_auth_headers(organization: create(:organization))
    token = JsonWebToken.encode(user_id: 1, role: 'admin', scheme: organization.scheme)
    { 'Authorization' => "Bearer #{token}" }
  end
end

RSpec.configure do |config|
  config.include AuthHelpers, type: :request
end
