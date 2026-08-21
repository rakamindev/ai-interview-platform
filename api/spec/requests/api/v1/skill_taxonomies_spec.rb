# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API Skill Taxonomies', type: :request do
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

  before { Rack::Attack.reset! }

  describe 'GET /api/v1/skill_taxonomies' do
    it 'returns list of skill taxonomies' do
      get '/api/v1/skill_taxonomies', headers: headers
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['skill_taxonomies']).to be_an(Array)
    end
  end
end
