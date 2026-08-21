# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API Sessions', type: :request do
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
  let!(:session_record) { create(:session, tenant_id: 1, assessment: assessment) }

  before { Rack::Attack.reset! }

  describe 'GET /api/v1/sessions/:id' do
    it 'returns single session' do
      get "/api/v1/sessions/#{session_record.id}", headers: headers
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['session']['id']).to eq(session_record.id)
    end
  end
end
