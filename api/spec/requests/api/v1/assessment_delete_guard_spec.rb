require 'rails_helper'

RSpec.describe 'Assessment delete guard (F-009)', type: :request do
  let(:organization) { create(:organization) }
  let(:headers)        { assessor_auth_headers(organization) }

  describe 'GET /api/v1/assessments exposes whether it has sessions' do
    it 'reports has_sessions: false for a fresh assessment' do
      create(:assessment, tenant_id: organization.id)

      get '/api/v1/assessments', headers: headers

      body = JSON.parse(response.body)
      expect(body['assessments'].first['has_sessions']).to be false
    end

    it 'reports has_sessions: true once a candidate has been invited' do
      assessment = create(:assessment, tenant_id: organization.id)
      create(:session, tenant_id: organization.id, assessment: assessment)

      get '/api/v1/assessments', headers: headers

      body = JSON.parse(response.body)
      expect(body['assessments'].first['has_sessions']).to be true
    end
  end

  describe 'DELETE /api/v1/assessments/:id' do
    it 'deletes an assessment with no sessions' do
      assessment = create(:assessment, tenant_id: organization.id)

      delete "/api/v1/assessments/#{assessment.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(Assessment.exists?(assessment.id)).to be false
    end

    it 'refuses to delete an assessment that has sessions' do
      assessment = create(:assessment, tenant_id: organization.id)
      create(:session, tenant_id: organization.id, assessment: assessment)

      delete "/api/v1/assessments/#{assessment.id}", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(Assessment.exists?(assessment.id)).to be true
    end
  end
end
