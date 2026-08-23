# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Assessments', type: :request do
  let(:user) { create(:user, :admin) }
  let(:headers) { auth_headers(user) }

  before { with_tenant }

  describe 'GET /api/v1/assessments' do
    let!(:assessment1) { create(:assessment, name: 'Assessment 1', tenant_id: 1) }
    let!(:assessment2) { create(:assessment, name: 'Assessment 2', tenant_id: 1) }
    let!(:other_tenant_assessment) { create(:assessment, name: 'Other Tenant', tenant_id: 2) }

    it 'returns paginated assessments for current tenant' do
      get '/api/v1/assessments', headers: headers

      expect_json_response
      expect(json_body['assessments'].size).to eq(2)
      expect(json_body['meta']).to be_present
    end

    it 'filters by tenant via TenantScoped' do
      get '/api/v1/assessments', headers: headers
      names = json_body['assessments'].map { |a| a['name'] }
      expect(names).not_to include('Other Tenant')
    end
  end

  describe 'GET /api/v1/assessments/:id' do
    let!(:assessment) { create(:assessment, :with_skills, tenant_id: 1) }

    it 'returns assessment with skills' do
      get "/api/v1/assessments/#{assessment.id}", headers: headers

      expect_json_response
      expect(json_body['assessment']['id']).to eq(assessment.id)
      expect(json_body['assessment']['skills']).to be_present
    end

    it 'returns 404 for non-existent assessment' do
      get '/api/v1/assessments/99999', headers: headers

      expect_error(status: :not_found, message: 'Assessment not found')
    end
  end

  describe 'POST /api/v1/assessments' do
    let(:valid_params) do
      {
        assessment: {
          name: 'New Assessment',
          time_limit_min: 60,
          language: 'en',
          assessment_skills_attributes: [
            {
              skill_id: 'SK-TEST-001',
              skill_label: 'Test Skill',
              is_custom: false,
              scope_include: 'Scope',
              scope_exclude: 'Exclude',
              l1_anchor: 'L1',
              l2_anchor: 'L2',
              l3_anchor: 'L3',
              l4_anchor: 'L4',
              l5_anchor: 'L5',
              display_order: 0
            }
          ]
        }
      }
    end

    it 'creates assessment and enqueues system prompt generation' do
      expect {
        post '/api/v1/assessments', params: valid_params, headers: headers
      }.to change(Assessment, :count).by(1)

      expect_json_response(status: :created)
      expect(json_body['assessment']['name']).to eq('New Assessment')
      expect(json_body['system_prompt_generated']).to be true
    end

    it 'returns error for invalid params' do
      post '/api/v1/assessments', params: { assessment: { name: '' } }, headers: headers

      expect_error(status: :unprocessable_entity)
    end
  end

  describe 'PUT /api/v1/assessments/:id' do
    let!(:assessment) { create(:assessment, tenant_id: 1) }

    it 'updates assessment and enqueues system prompt generation' do
      put "/api/v1/assessments/#{assessment.id}",
          params: { assessment: { name: 'Updated Name' } },
          headers: headers

      expect_json_response
      expect(json_body['assessment']['name']).to eq('Updated Name')
      expect(json_body['system_prompt_generated']).to be true
    end

    it 'returns 404 for non-existent assessment' do
      put '/api/v1/assessments/99999', params: { assessment: { name: 'Test' } }, headers: headers

      expect_error(status: :not_found)
    end
  end

  describe 'DELETE /api/v1/assessments/:id' do
    let!(:assessment) { create(:assessment, tenant_id: 1) }

    it 'deletes assessment' do
      expect {
        delete "/api/v1/assessments/#{assessment.id}", headers: headers
      }.to change(Assessment, :count).by(-1)

      expect_json_response
    end

    it 'returns 404 for non-existent assessment' do
      delete '/api/v1/assessments/99999', headers: headers

      expect_error(status: :not_found)
    end
  end

  describe 'GET /api/v1/assessments/:assessment_id/sessions' do
    let!(:assessment) { create(:assessment, tenant_id: 1) }
    let!(:session1) { create(:session, assessment: assessment, status: 'active') }
    let!(:session2) { create(:session, assessment: assessment, status: 'ended') }

    it 'returns sessions for assessment' do
      get "/api/v1/assessments/#{assessment.id}/sessions", headers: headers

      expect_json_response
      expect(json_body['sessions'].size).to eq(2)
    end
  end

  describe 'POST /api/v1/assessments/:assessment_id/sessions' do
    let!(:assessment) { create(:assessment, tenant_id: 1) }

    it 'creates session for assessment' do
      expect {
        post "/api/v1/assessments/#{assessment.id}/sessions",
             params: { session: { candidate_id: 42, candidate_name: 'Test Candidate' } },
             headers: headers
      }.to change(Session, :count).by(1)

      expect_json_response(status: :created)
      expect(json_body['session']['candidate_id']).to eq(42)
      expect(json_body['invite_url']).to be_present
    end

    it 'returns 404 for non-existent assessment' do
      post '/api/v1/assessments/99999/sessions', params: { session: {} }, headers: headers

      expect_error(status: :not_found)
    end
  end
end