# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Authentication', type: :request do
  describe 'POST /api/v1/auth/login' do
    let(:org) { create(:organization, scheme: 'acme') }

    before do
      create(:user, organization: org, email: 'admin@acme.com', password: 'password123', role: 'admin')
    end

    it "issues a token whose scheme is the user's own organization" do
      post '/api/v1/auth/login', params: { email: 'admin@acme.com', password: 'password123' }

      expect(response).to have_http_status(:ok)
      claims = JsonWebToken.decode(JSON.parse(response.body)['token'])
      expect(claims[:scheme]).to eq('acme')
    end

    it 'ignores a spoofed X-Tenant-Scheme header and still uses the user org (P1-1)' do
      create(:organization, scheme: 'victim')

      post '/api/v1/auth/login',
           params: { email: 'admin@acme.com', password: 'password123' },
           headers: { 'X-Tenant-Scheme' => 'victim' }

      expect(response).to have_http_status(:ok)
      claims = JsonWebToken.decode(JSON.parse(response.body)['token'])
      expect(claims[:scheme]).to eq('acme')
    end

    it 'rejects an admin that is not linked to an organization' do
      create(:user, organization: nil, email: 'orphan@nowhere.com', password: 'password123', role: 'admin')

      post '/api/v1/auth/login', params: { email: 'orphan@nowhere.com', password: 'password123' }

      expect(response).to have_http_status(:forbidden)
    end

    it 'rejects a wrong password' do
      post '/api/v1/auth/login', params: { email: 'admin@acme.com', password: 'nope' }

      expect(response).to have_http_status(:unauthorized)
    end

    it 'rejects a non-admin role' do
      create(:user, organization: org, email: 'peon@acme.com', password: 'password123', role: 'user')

      post '/api/v1/auth/login', params: { email: 'peon@acme.com', password: 'password123' }

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
