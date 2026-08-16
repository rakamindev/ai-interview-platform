# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Api::V1::SkillTaxonomiesController, type: :request do # rubocop:disable Metrics/BlockLength
  let(:tenant) { create(:organization) }
  let(:headers) { auth_header_for(organization: tenant) }

  describe 'GET /api/v1/skill_taxonomies' do
    it 'lists all taxonomies' do
      create(:skill_taxonomy, skill_id: 'ruby')
      create(:skill_taxonomy, skill_id: 'sql', category: 'engineering')

      get '/api/v1/skill_taxonomies', headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['skill_taxonomies'].size).to eq(2)
    end

    it 'filters by category' do
      create(:skill_taxonomy, skill_id: 'ruby', category: 'engineering')
      create(:skill_taxonomy, skill_id: 'stakeholder', category: 'soft_skills')

      get '/api/v1/skill_taxonomies?category=engineering', headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['skill_taxonomies'].map { |s| s['skill_id'] }).to eq(%w[ruby])
    end

    it 'requires an assessor token' do
      get '/api/v1/skill_taxonomies'

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe 'GET /api/v1/skill_taxonomies/:skill_id' do
    it 'returns a skill by id' do
      create(:skill_taxonomy, skill_id: 'ruby', skill_label: 'Ruby')

      get '/api/v1/skill_taxonomies/ruby', headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['skill']['skill_label']).to eq('Ruby')
    end

    it 'returns 404 for an unknown skill' do
      get '/api/v1/skill_taxonomies/unknown-skill', headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end
end
