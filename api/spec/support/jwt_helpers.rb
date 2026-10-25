module JwtHelpers
  def auth_headers(scheme:, role: "admin", user_id: 1)
    token = JsonWebToken.encode(user_id: user_id, role: role, scheme: scheme)
    { "Authorization" => "Bearer #{token}" }
  end
end

RSpec.configure do |config|
  config.include JwtHelpers, type: :request
end
