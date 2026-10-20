# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Login', type: :request do
  include ActiveSupport::Testing::TimeHelpers

  let!(:user) { User.create!(email: 'a@mail.com', password: 'secret123', role: 'admin') }
  let(:creds) { { email: 'a@mail.com', password: 'secret123' } }

  def login(params) = post('/api/v1/auth/login', params:, as: :json)

  it 'logs in with the right credentials' do
    login creds
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body['token']).to be_present
  end

  it 'stores a bcrypt hash, never the raw password' do
    expect(user.password_digest).not_to include('secret123')
    expect(user.password_digest).to start_with('$2')
  end

  it 'returns the same error for wrong password and unknown email' do
    login creds.merge(password: 'wrong-pass')
    a = [response.status, response.body]
    login creds.merge(email: 'nobody@mail.com')
    b = [response.status, response.body]

    expect(a).to eq(b)
    expect(a.first).to eq(401)
    expect(a.last).to include('Invalid email or password')
  end

  describe 'protected endpoints' do
    let(:path) { '/api/v1/assessments' }
    let(:token) do
      login(creds)
      response.parsed_body['token']
    end

    it 'returns 401 without a token' do
      get path
      expect(response).to have_http_status(:unauthorized)
    end

    it 'returns 401 with a clear message for an expired token' do
      t = token
      travel_to(1.year.from_now) do
        get path, headers: { 'Authorization' => "Bearer #{t}" }
      end
      expect(response).to have_http_status(:unauthorized)
      expect(response.body).to match(/expired/i)
    end

  end
end