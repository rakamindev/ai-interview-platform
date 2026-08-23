# frozen_string_literal: true

# spec/support/auth_helpers.rb
module AuthHelpers
  def auth_headers(user, role = 'admin', scheme = 'test-corp')
    token = JsonWebToken.encode(user_id: user.id, role: role, scheme: scheme)
    { 'Authorization' => "Bearer #{token}" }
  end

  def candidate_headers(session)
    token = JsonWebToken.encode(user_id: 2, role: 'student', scheme: 'test-corp')
    { 'Authorization' => "Bearer #{token}" }
  end
end

RSpec.configure do |config|
  config.include AuthHelpers, type: :request
end