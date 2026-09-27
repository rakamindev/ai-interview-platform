# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Authentication API', type: :request do
  let!(:org) { create(:organization, scheme: 'test-corp') }
  let!(:admin) { create(:user, :admin, email: 'admin@test.com', password: 'secretpassword', organization: org) }
  let!(:assessor) do
    create(:user, :assessor, email: 'assessor@test.com', password: 'secretpassword', organization: org)
  end
  let!(:member) do
    create(:user, role: 'user', email: 'member@test.com', password: 'secretpassword', organization: org)
  end

  describe 'POST /api/v1/auth/login' do
    before do
      Rack::Attack.reset!
    end

    it 'authenticates admin successfully and returns token and user payload' do
      post '/api/v1/auth/login',
           params: { email: 'admin@test.com', password: 'secretpassword' }.to_json,
           headers: { 'Content-Type' => 'application/json' }

      expect(response).to have_http_status(:ok)
      expect(json_body[:token]).to be_present
      expect(json_body[:user]).to include(
        id: admin.id,
        email: 'admin@test.com',
        role: 'admin'
      )
      decoded = JsonWebToken.decode(json_body[:token])
      expect(decoded[:scheme]).to eq('test-corp')
      expect(decoded[:role]).to eq('admin')
    end

    it 'authenticates assessor successfully and returns token with organization scheme' do
      post '/api/v1/auth/login',
           params: { email: 'assessor@test.com', password: 'secretpassword' }.to_json,
           headers: { 'Content-Type' => 'application/json' }

      expect(response).to have_http_status(:ok)
      expect(json_body[:token]).to be_present
      expect(json_body[:user]).to include(
        id: assessor.id,
        email: 'assessor@test.com',
        role: 'assessor'
      )
      decoded = JsonWebToken.decode(json_body[:token])
      expect(decoded[:scheme]).to eq('test-corp')
      expect(decoded[:role]).to eq('assessor')
    end

    it 'authenticates assessor from another organization and returns that organization scheme' do
      other_org = create(:organization, scheme: 'acme-corp')
      create(:user, :assessor, email: 'other@test.com', password: 'secretpassword', organization: other_org)

      post '/api/v1/auth/login',
           params: { email: 'other@test.com', password: 'secretpassword' }.to_json,
           headers: { 'Content-Type' => 'application/json' }

      expect(response).to have_http_status(:ok)
      decoded = JsonWebToken.decode(json_body[:token])
      expect(decoded[:scheme]).to eq('acme-corp')
      expect(decoded[:role]).to eq('assessor')
    end

    it 'rejects invalid credentials with 401 and errors envelope' do
      post '/api/v1/auth/login',
           params: { email: 'admin@test.com', password: 'wrongpassword' }.to_json,
           headers: { 'Content-Type' => 'application/json' }

      expect(response).to have_http_status(:unauthorized)
      expect(json_body[:errors].first[:message]).to eq('Invalid email or password')
    end

    it 'rejects standard non-admin and non-assessor users with 401' do
      post '/api/v1/auth/login',
           params: { email: 'member@test.com', password: 'secretpassword' }.to_json,
           headers: { 'Content-Type' => 'application/json' }

      expect(response).to have_http_status(:unauthorized)
      expect(json_body[:errors].first[:message]).to eq('Invalid email or password')
    end

    it 'does not override user organization scheme with client X-Tenant-Scheme header' do
      post '/api/v1/auth/login',
           params: { email: 'admin@test.com', password: 'secretpassword' }.to_json,
           headers: {
             'Content-Type' => 'application/json',
             'X-Tenant-Scheme' => 'injected-tenant-scheme'
           }

      expect(response).to have_http_status(:ok)
      token = json_body[:token]
      decoded = JsonWebToken.decode(token)
      expect(decoded[:scheme]).to eq('test-corp')
    end

    it 'falls back to Organization.first scheme when user has no bound organization' do
      create(:user, :admin, email: 'unbound@test.com', password: 'secretpassword', organization: nil)

      post '/api/v1/auth/login',
           params: { email: 'unbound@test.com', password: 'secretpassword' }.to_json,
           headers: { 'Content-Type' => 'application/json' }

      expect(response).to have_http_status(:ok)
      token = json_body[:token]
      decoded = JsonWebToken.decode(token)
      expect(decoded[:scheme]).to eq('test-corp')
    end
  end
end
