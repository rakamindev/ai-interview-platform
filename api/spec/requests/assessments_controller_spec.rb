# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Api::V1::AssessmentsController, type: :request do # rubocop:disable Metrics/BlockLength
  let(:tenant_a) { create(:organization) }
  let(:tenant_b) { create(:organization) }
  let(:headers_a) { auth_header_for(organization: tenant_a) }
  let(:headers_b) { auth_header_for(organization: tenant_b) }

  let!(:assessment_a) { create(:assessment, tenant_id: tenant_a.id) }
  let!(:assessment_b) { create(:assessment, tenant_id: tenant_b.id) }

  describe 'GET /api/v1/assessments' do
    it 'lists only assessments from the caller tenant' do
      get '/api/v1/assessments', headers: headers_a

      expect(response).to have_http_status(:ok)
      ids = response.parsed_body['assessments'].map { |a| a['id'] }
      expect(ids).to include(assessment_a.id)
      expect(ids).not_to include(assessment_b.id)
    end

    it 'requires an assessor token' do
      get '/api/v1/assessments'

      expect(response).to have_http_status(:unauthorized)
    end

    it 'rejects a plain user token' do
      get '/api/v1/assessments', headers: auth_header_for(organization: tenant_a, role: 'user')

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe 'GET /api/v1/assessments/:id' do
    it 'shows own assessment' do
      get "/api/v1/assessments/#{assessment_a.id}", headers: headers_a

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['assessment']['id']).to eq(assessment_a.id)
    end

    it 'blocks reading another tenant assessment' do
      get "/api/v1/assessments/#{assessment_b.id}", headers: headers_a

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/assessments' do # rubocop:disable Metrics/BlockLength
    it 'creates an assessment with nested skills and enqueues prompt generation' do
      expect do
        post '/api/v1/assessments',
             params: { assessment: {
               name: 'Ruby Interview',
               time_limit_min: 45,
               language: 'en',
               assessment_skills_attributes: [
                 { skill_id: 'ruby', skill_label: 'Ruby', is_custom: false,
                   l1_anchor: 'Knows puts', l2_anchor: 'Blocks', l3_anchor: 'Metaprogramming',
                   l4_anchor: 'C extensions', l5_anchor: 'Language design',
                   expected_level: 3, display_order: 0 }
               ]
             } },
             headers: headers_a
      end.to change(SystemPromptGeneratorWorker.jobs, :size).by(1)

      expect(response).to have_http_status(:created)
      assessment = Assessment.last
      expect(assessment.tenant_id).to eq(tenant_a.id)
      expect(assessment.created_by).to eq(1)
      expect(assessment.assessment_skills.count).to eq(1)
    end

    it 'rejects an assessment without a name' do
      post '/api/v1/assessments',
           params: { assessment: { name: '', time_limit_min: 45 } },
           headers: headers_a

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe 'PUT /api/v1/assessments/:id' do # rubocop:disable Metrics/BlockLength
    it 'updates own assessment' do
      put "/api/v1/assessments/#{assessment_a.id}",
          params: { assessment: { name: 'Renamed' } },
          headers: headers_a

      expect(response).to have_http_status(:ok)
      expect(assessment_a.reload.name).to eq('Renamed')
    end

    it 'destroys skills marked with _destroy' do
      keep = create(:assessment_skill, assessment: assessment_a, display_order: 0)
      drop = create(:assessment_skill, assessment: assessment_a, display_order: 1)

      put "/api/v1/assessments/#{assessment_a.id}",
          params: { assessment: {
            name: assessment_a.name,
            time_limit_min: assessment_a.time_limit_min,
            assessment_skills_attributes: [
              { id: drop.id, _destroy: true },
              { id: keep.id, _destroy: false }
            ]
          } },
          headers: headers_a

      expect(response).to have_http_status(:ok)
      expect(assessment_a.reload.assessment_skills.pluck(:id)).to eq([keep.id])
    end

    it 'blocks updating another tenant assessment' do
      put "/api/v1/assessments/#{assessment_b.id}",
          params: { assessment: { name: 'Hacked' } },
          headers: headers_a

      expect(response).to have_http_status(:not_found)
      expect(assessment_b.reload.name).not_to eq('Hacked')
    end
  end

  describe 'DELETE /api/v1/assessments/:id' do
    it 'deletes own assessment' do
      expect do
        delete "/api/v1/assessments/#{assessment_a.id}", headers: headers_a
      end.to change(Assessment, :count).by(-1)

      expect(response).to have_http_status(:ok)
    end

    it 'blocks deleting another tenant assessment' do
      delete "/api/v1/assessments/#{assessment_b.id}", headers: headers_a

      expect(response).to have_http_status(:not_found)
      expect(Assessment.exists?(assessment_b.id)).to be(true)
    end
  end
end
