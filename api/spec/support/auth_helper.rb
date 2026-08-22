# frozen_string_literal: true

module AuthHelper
  def auth_headers(user_id:, role: 'admin', scheme: 'test-corp')
    token = JsonWebToken.encode(user_id: user_id, role: role, scheme: scheme)
    { 'Authorization' => "Bearer #{token}" }
  end

  def stub_tenant(tenant_id: 1)
    allow_any_instance_of(ApplicationController).to receive(:require_tenant!).and_return(true)
    Current.tenant_id = tenant_id
  end
end

RSpec.configure do |config|
  config.include AuthHelper, type: :request
end
