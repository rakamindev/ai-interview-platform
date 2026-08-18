# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Assessments', type: :request do
  let(:org) { create(:organization, scheme: 'test-corp') }
  let(:user) { create(:user, email: 'assessor@test-corp.local', role: 'assessor', organization: org) }
  let(:headers) { jwt_for(user: user, scheme: org.scheme) }
  let(:assessment) { create(:assessment, tenant_id: org.id) }

  describe 'DELETE /api/v1/assessments/:id' do
    context 'when assessment has dependent sessions' do
      it 'returns 422 with the model error' do
        create(:session, assessment: assessment, tenant_id: org.id)

        delete "/api/v1/assessments/#{assessment.id}", headers: headers

        expect(response).to have_http_status(:unprocessable_entity)
        body = JSON.parse(response.body)
        expect(body['error']).to be_present
        expect(body['error']).to match(/session/i)
      end
    end

    context 'when assessment has no dependent sessions' do
      it 'returns success' do
        delete "/api/v1/assessments/#{assessment.id}", headers: headers

        expect(response).to have_http_status(:ok)
        expect(Assessment.find_by(id: assessment.id)).to be_nil
      end
    end
  end
end
