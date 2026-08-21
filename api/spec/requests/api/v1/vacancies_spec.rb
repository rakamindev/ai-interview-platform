# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API Vacancies', type: :request do
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

  let!(:vacancy) { create(:vacancy, tenant_id: 1, created_by: 1) }

  before { Rack::Attack.reset! }

  describe 'GET /api/v1/vacancies' do
    it 'returns list of vacancies' do
      get '/api/v1/vacancies', headers: headers
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['vacancies']).to be_an(Array)
    end
  end

  describe 'GET /api/v1/vacancies/:id' do
    it 'returns single vacancy' do
      get "/api/v1/vacancies/#{vacancy.id}", headers: headers
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['vacancy']['id']).to eq(vacancy.id)
    end
  end
end
