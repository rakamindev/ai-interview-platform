# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::SkillTaxonomies', type: :request do
  let(:user) { create(:user, :admin) }
  let(:headers) { auth_headers(user) }

  before do
    with_tenant
    create(:skill_taxonomy, skill_id: 'SK-ENG-001', category: 'engineering')
    create(:skill_taxonomy, skill_id: 'SK-SOFT-001', category: 'soft_skills')
  end

  describe 'GET /api/v1/skill_taxonomies' do
    it 'returns all skill taxonomies' do
      get '/api/v1/skill_taxonomies', headers: headers

      expect_json_response
      expect(json_body['skill_taxonomies'].size).to eq(2)
    end

    it 'filters by category' do
      get '/api/v1/skill_taxonomies?category=engineering', headers: headers

      expect_json_response
      expect(json_body['skill_taxonomies'].size).to eq(1)
      expect(json_body['skill_taxonomies'].first['category']).to eq('engineering')
    end
  end

  describe 'GET /api/v1/skill_taxonomies/:skill_id' do
    it 'returns skill taxonomy by skill_id' do
      get '/api/v1/skill_taxonomies/SK-ENG-001', headers: headers

      expect_json_response
      expect(json_body['skill']['skill_id']).to eq('SK-ENG-001')
    end

    it 'returns 404 for non-existent skill' do
      get '/api/v1/skill_taxonomies/NON-EXISTENT', headers: headers

      expect_error(status: :not_found)
    end
  end
end