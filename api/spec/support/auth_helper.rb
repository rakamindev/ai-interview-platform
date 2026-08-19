# frozen_string_literal: true

module AuthHelper
  def jwt_for(user:, scheme:)
    token = JsonWebToken.encode(user_id: user.id, role: user.role, scheme: scheme)
    { "Authorization" => "Bearer #{token}" }
  end
end
