# frozen_string_literal: true

module AuthHelpers
  def bearer_for(organization:, role: 'admin', user: nil)
    user ||= create(:user, organization: organization, role: role)
    token = JsonWebToken.encode(user_id: user.id, role: user.role, scheme: organization.scheme)
    { 'Authorization' => "Bearer #{token}" }
  end
end

RSpec.configure do |config|
  config.include AuthHelpers, type: :request
end
