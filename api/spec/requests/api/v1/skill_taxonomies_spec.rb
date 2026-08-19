# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::SkillTaxonomies', type: :request do
  let(:admin) { create(:admin) }
  let(:headers) { auth_json_headers(admin) }

  describe 'GET /api/v1/skill_taxonomies' do
    before do
      create(:skill_taxonomy, skill_id: 'sk-1', category: 'engineering')
      create(:skill_taxonomy, skill_id: 'sk-2', category: 'soft_skills')
    end

    it 'returns all skill taxonomies' do
      get '/api/v1/skill_taxonomies', headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['skill_taxonomies'].length).to eq(2)
    end

    it 'filters by category' do
      get '/api/v1/skill_taxonomies?category=engineering', headers: headers

      body = JSON.parse(response.body)
      expect(body['skill_taxonomies'].length).to eq(1)
      expect(body['skill_taxonomies'].first['category']).to eq('engineering')
    end
  end

  describe 'GET /api/v1/skill_taxonomies/:skill_id' do
    let!(:taxonomy) { create(:skill_taxonomy, skill_id: 'sk-react') }

    it 'returns the skill taxonomy' do
      get '/api/v1/skill_taxonomies/sk-react', headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['skill']['skill_id']).to eq('sk-react')
    end

    it 'returns 404 for non-existent skill' do
      get '/api/v1/skill_taxonomies/nonexistent', headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end
end
