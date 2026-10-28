# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Authentication', type: :request do
  # Login is throttled by Rack::Attack (5/min/IP, Redis-backed). Counters are
  # global, so clear them before every example — otherwise a second local run
  # inside the same minute fails with 429 for the wrong reason.
  before { Rack::Attack.reset! }

  let(:scheme) { "rspec-#{SecureRandom.hex(4)}" }

  let!(:organization) do
    Organization.create!(
      name:       'RSpec Tenant',
      scheme:,
      identifier: "rspec-#{SecureRandom.hex(4)}",
      host:       "rspec-#{SecureRandom.hex(4)}.test"
    )
  end

  let(:admin) do
    User.create!(
      email:    "admin-#{SecureRandom.hex(4)}@example.test",
      password: 'password123',
      role:     'admin'
    )
  end

  let(:candidate) do
    User.create!(
      email:    "candidate-#{SecureRandom.hex(4)}@example.test",
      password: 'password123',
      role:     'user'
    )
  end

  def login(email, password)
    post '/api/v1/auth/login',
         params: { email:, password: },
         headers: { 'X-Tenant-Scheme' => scheme },
         as: :json
    response.parsed_body
  end

  def bearer_token(user)
    post '/api/v1/auth/login',
         params: { email: user.email, password: 'password123' },
         headers: { 'X-Tenant-Scheme' => scheme },
         as: :json
    response.parsed_body.fetch('token')
  end

  describe 'POST /api/v1/auth/login' do
    it 'issues a token for the admin superuser' do
      body = login(admin.email, 'password123')

      expect(response).to have_http_status(:ok)
      expect(body['token']).to be_present
      expect(body['user']).to include('id' => admin.id, 'email' => admin.email, 'role' => 'admin')
    end

    it 'issues a token for a candidate (user) account' do
      body = login(candidate.email, 'password123')

      expect(response).to have_http_status(:ok)
      expect(body['token']).to be_present
      expect(body['user']).to include('id' => candidate.id, 'email' => candidate.email, 'role' => 'user')
    end

    it 'rejects a wrong password' do
      login(admin.email, 'not-the-password')

      expect(response).to have_http_status(:unauthorized)
      expect(response.parsed_body['errors'].first['message']).to eq('Invalid email or password')
    end

    it 'rejects an unknown email with the same message (no account enumeration)' do
      login("nobody-#{SecureRandom.hex(4)}@example.test", 'password123')

      expect(response).to have_http_status(:unauthorized)
      expect(response.parsed_body['errors'].first['message']).to eq('Invalid email or password')
    end
  end

  describe 'authorization is not widened by candidate login' do
    it 'lets the admin superuser read assessor data' do
      token = bearer_token(admin)

      get '/api/v1/assessments', headers: { Authorization: "Bearer #{token}" }

      expect(response).to have_http_status(:ok)
    end

    it 'still forbids a candidate (user) token from reading assessor data' do
      token = bearer_token(candidate)

      get '/api/v1/assessments', headers: { Authorization: "Bearer #{token}" }

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe 'login rate limiting (Rack::Attack)' do
    it 'throttles the 6th login attempt within a minute' do
      5.times { login(candidate.email, 'wrong-password') }

      login(candidate.email, 'password123')

      expect(response).to have_http_status(:too_many_requests)
      expect(response.parsed_body['error']).to include('Too many requests')
    end
  end
end
