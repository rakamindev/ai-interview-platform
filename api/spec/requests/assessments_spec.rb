# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Assessments API delete', type: :request do
  let!(:org) { create(:organization, scheme: 'test-corp') }

  it 'returns 422 (not a false success) when the assessment still has sessions' do
    in_tenant(org) do
      assessment = create(:assessment)
      create(:session, assessment: assessment)
      headers = auth_header_for(scheme: 'test-corp')

      expect do
        delete "/api/v1/assessments/#{assessment.id}", headers: headers
      end.not_to change { Assessment.count }

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['errors'].first['message']).to include('dependent sessions exist')
    end
  end

  it 'deletes an assessment that has no sessions' do
    in_tenant(org) do
      assessment = create(:assessment)
      headers = auth_header_for(scheme: 'test-corp')

      expect do
        delete "/api/v1/assessments/#{assessment.id}", headers: headers
      end.to change { Assessment.count }.by(-1)

      expect(response).to have_http_status(:ok)
    end
  end
end