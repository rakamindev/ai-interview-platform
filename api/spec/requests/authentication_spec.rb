# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Authentication' do
  let!(:org) { create(:organization) }
  let!(:user) { create(:user, email: 'assessor@example.com', password: 'secret123', role: 'admin') }

  context 'POST /api/v1/auth/login' do
    it 'logs in when the tenant scheme is resolvable from the request' do
      post '/api/v1/auth/login', params: { email: 'assessor@example.com', password: 'secret123' },
                                 headers: { 'X-Tenant-Scheme' => org.scheme }

      expect(response).to have_http_status(:ok)
      payload = response.parsed_body
      expect(payload['token']).to be_present
      expect(JsonWebToken.decode(payload['token'])[:scheme]).to eq(org.scheme)
    end

    it 'fails closed when no tenant scheme can be resolved (no silent LIMIT 1 fallback)' do
      post '/api/v1/auth/login', params: { email: 'assessor@example.com', password: 'secret123' }

      expect(response).to have_http_status(:unauthorized)
      expect(response.parsed_body['errors'].first['message']).to include('scheme')
    end

    it 'rejects a wrong password' do
      post '/api/v1/auth/login', params: { email: 'assessor@example.com', password: 'wrong' },
                                 headers: { 'X-Tenant-Scheme' => org.scheme }

      expect(response).to have_http_status(:unauthorized)
    end
  end
end