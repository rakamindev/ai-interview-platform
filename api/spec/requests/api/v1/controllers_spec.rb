# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API Controllers', type: :request do
  let!(:org) do
    Organization.find_or_create_by!(id: 1) do |o|
      o.identifier = 'org1'
      o.name = 'Org 1'
      o.scheme = 'org1'
      o.host = 'localhost'
    end
  end

  let(:token) { JsonWebToken.encode(user_id: 1, role: 'admin', scheme: 'org1') }
  let(:headers) do
    {
      'Authorization' => "Bearer #{token}",
      'X-Tenant-Scheme' => 'org1'
    }
  end

  let!(:assessment) { create(:assessment, tenant_id: 1, created_by: 1) }

  before { Rack::Attack.reset! }

  describe 'GET /api/v1/assessments' do
    it 'returns list of assessments' do
      get '/api/v1/assessments', headers: headers
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['assessments']).to be_an(Array)
    end
  end

  describe 'GET /api/v1/assessments/:id' do
    it 'returns single assessment' do
      get "/api/v1/assessments/#{assessment.id}", headers: headers
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['assessment']['id']).to eq(assessment.id)
    end
  end

  describe 'DELETE /api/v1/assessments/:id' do
    it 'deletes the assessment' do
      expect {
        delete "/api/v1/assessments/#{assessment.id}", headers: headers
      }.to change(Assessment, :count).by(-1)
      expect(response).to have_http_status(:ok)
    end
  end

  describe 'POST /api/v1/auth/login' do
    let!(:user) { create(:user, email: 'assessor@example.com', password: 'password123', role: 'admin') }

    it 'returns token on valid credentials' do
      post '/api/v1/auth/login', params: { email: 'assessor@example.com', password: 'password123' }, headers: { 'X-Tenant-Scheme' => 'org1' }
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['token']).to be_present
    end

    it 'returns 401 on invalid password' do
      post '/api/v1/auth/login', params: { email: 'assessor@example.com', password: 'wrong' }, headers: { 'X-Tenant-Scheme' => 'org1' }
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
