# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Assessments API', type: :request do
  let(:tenant_scheme) { 'test-corp' }
  let(:assessor_token) do
    JsonWebToken.encode({ user_id: 1, role: 'assessor', scheme: tenant_scheme })
  end
  let(:auth_headers) do
    {
      'Authorization' => "Bearer #{assessor_token}",
      'X-Tenant-Scheme' => tenant_scheme,
      'Content-Type' => 'application/json'
    }
  end

  before do
    allow(SystemPromptGeneratorWorker).to receive(:perform_async)
  end

  describe 'GET /api/v1/assessments' do
    it 'returns paginated list of assessments' do
      Assessment.create!(name: 'Staff Backend Engineer', time_limit_min: 45, tenant_id: 'tenant-123')

      get '/api/v1/assessments', headers: auth_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['assessments']).to be_an(Array)
      expect(json['assessments'].first['name']).to eq('Staff Backend Engineer')
    end
  end

  describe 'POST /api/v1/assessments' do
    it 'creates assessment with language and nested skills attributes' do
      payload = {
        assessment: {
          name: 'Principal Architect (ID)',
          time_limit_min: 60,
          language: 'id',
          assessment_skills_attributes: [
            {
              skill_label: 'Cloud Infrastructure',
              expected_level: 4,
              display_order: 1,
              l1_anchor: 'Basic compute',
              l2_anchor: 'VPC setup',
              l3_anchor: 'Multi-AZ HA',
              l4_anchor: 'Disaster recovery topology',
              l5_anchor: 'Multi-region mesh'
            }
          ]
        }
      }

      post '/api/v1/assessments', params: payload.to_json, headers: auth_headers

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json['assessment']['name']).to eq('Principal Architect (ID)')
      expect(json['assessment']['language']).to eq('id')
      expect(SystemPromptGeneratorWorker).to have_received(:perform_async)
    end

    it 'returns 422 if name or time_limit is invalid' do
      payload = { assessment: { name: '', time_limit_min: 99 } }

      post '/api/v1/assessments', params: payload.to_json, headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe 'GET /api/v1/assessments/:id' do
    it 'returns assessment with detailed skill anchors' do
      assessment = Assessment.create!(
        name: 'Frontend Lead',
        time_limit_min: 30,
        tenant_id: 'tenant-123'
      )

      get "/api/v1/assessments/#{assessment.id}", headers: auth_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['assessment']['name']).to eq('Frontend Lead')
    end

    it 'returns 404 when assessment does not exist' do
      get '/api/v1/assessments/9999999', headers: auth_headers

      expect(response).to have_http_status(:not_found)
    end
  end
end
