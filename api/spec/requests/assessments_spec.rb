# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Assessments', type: :request do
  let(:org) { create(:organization, scheme: 'test-corp') }
  let(:token) { JsonWebToken.encode(user_id: 1, role: 'admin', scheme: org.scheme) }
  let(:headers) { { 'Authorization' => "Bearer #{token}", 'Content-Type' => 'application/json' } }

  describe 'GET /api/v1/assessments' do
    it 'returns paginated assessments' do
      create_list(:assessment, 3, tenant_id: org.id)

      get '/api/v1/assessments', headers: headers
      expect(response).to have_http_status(:ok)

      json = JSON.parse(response.body)
      expect(json['assessments'].length).to eq(3)
      expect(json['meta']['total_count']).to eq(3)
    end
  end

  describe 'POST /api/v1/assessments' do
    it 'creates a new assessment with nested skills' do
      payload = {
        assessment: {
          name: 'Principal Engineer',
          time_limit_min: 60,
          language: 'en',
          assessment_skills_attributes: [
            {
              skill_label: 'Architecture',
              expected_level: 4,
              l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5',
              display_order: 0
            }
          ]
        }
      }.to_json

      post '/api/v1/assessments', params: payload, headers: headers
      expect(response).to have_http_status(:created)

      json = JSON.parse(response.body)
      expect(json['assessment']['name']).to eq('Principal Engineer')
    end
  end

  describe 'DELETE /api/v1/assessments/:id (P1-1 verification)' do
    let!(:assessment) { create(:assessment, tenant_id: org.id) }

    it 'deletes successfully when no candidate sessions exist' do
      delete "/api/v1/assessments/#{assessment.id}", headers: headers
      expect(response).to have_http_status(:ok)
      expect(Assessment.find_by(id: assessment.id)).to be_nil
    end

    it 'fails with 422 unprocessable_entity when candidate sessions exist' do
      create(:session, assessment: assessment, tenant_id: org.id)

      delete "/api/v1/assessments/#{assessment.id}", headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
      expect(Assessment.find_by(id: assessment.id)).to be_present

      json = JSON.parse(response.body)
      expect(json['errors']).to be_present
    end
  end
end
