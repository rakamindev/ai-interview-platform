# frozen_string_literal: true

require 'rails_helper'

# The login throttle is disabled by default in the test env so auth specs are
# deterministic (no shared Redis counter across runs). This spec proves the
# throttle itself still works: it re-enables Rack::Attack and uses an isolated
# IP so counters never leak into other tests.
RSpec.describe 'Login rate limiting', type: :request do
  let!(:org) { create(:organization, scheme: 'test-corp', identifier: 'test-corp', name: 'Test Corp', host: 'localhost') }
  let!(:user) { create(:user, email: 'admin@test-corp.dev', password: password, role: 'admin') }
  let(:password) { SecureRandom.alphanumeric(12) }

  around do |example|
    Rack::Attack.enabled = true
    example.run
  ensure
    Rack::Attack.enabled = false
  end

  it 'returns 429 after 5 login attempts from the same IP' do
    # Unique IP per run — the throttle counter lives in Redis for 1 minute.
    ip = "203.0.113.#{rand(1..254)}"
    headers = { 'REMOTE_ADDR' => ip }

    5.times do
      post '/api/v1/auth/login', params: { email: 'admin@test-corp.dev', password: "wrong-#{password}" }, headers: headers
      expect(response).to have_http_status(:unauthorized)
    end

    post '/api/v1/auth/login', params: { email: 'admin@test-corp.dev', password: "wrong-#{password}" }, headers: headers

    expect(response).to have_http_status(:too_many_requests)
  end
end
