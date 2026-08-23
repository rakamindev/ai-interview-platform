# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Assessments', type: :request do
  let(:organization) { create(:organization) }
  let(:user) { create(:user, role: 'admin') }
  let(:headers) { authenticated_header(user, organization: organization) }

  describe 'GET /api/v1/assessments' do
    it 'returns a list of assessments scoped to tenant' do
      create_list(:assessment, 2, tenant_id: organization.id)

      get '/api/v1/assessments', headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_response['assessments'].length).to eq(2)
    end
  end

  describe 'POST /api/v1/assessments' do
    it 'creates an assessment with nested assessment_skills and returns skills in envelope' do
      payload = {
        assessment: {
          name: 'Lead AI Engineer',
          time_limit_min: 45,
          language: 'en',
          assessment_skills_attributes: [
            {
              skill_label: 'React Core',
              expected_level: 3,
              is_custom: false,
              display_order: 0,
              l1_anchor: 'Basic JSX',
              l2_anchor: 'Component state',
              l3_anchor: 'Complex features',
              l4_anchor: 'Frontend lead',
              l5_anchor: 'Architecture authority'
            },
            {
              skill_label: 'System Design',
              expected_level: 4,
              is_custom: false,
              display_order: 1,
              l1_anchor: 'Basic HTTP',
              l2_anchor: 'CRUD APIs',
              l3_anchor: 'Caching & Queues',
              l4_anchor: 'Distributed systems',
              l5_anchor: 'Enterprise architect'
            }
          ]
        }
      }

      post '/api/v1/assessments', params: payload.to_json, headers: headers

      expect(response).to have_http_status(:created)
      expect(json_response['assessment']['name']).to eq('Lead AI Engineer')
      expect(json_response['assessment']['skills'].length).to eq(2)
      expect(json_response['system_prompt_generated']).to eq(true)
    end
  end
end
