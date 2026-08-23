# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Sessions', type: :request do
  let(:organization) { create(:organization) }
  let(:user) { create(:user, role: 'admin') }
  let(:assessment) { create(:assessment, tenant_id: organization.id) }
  let(:headers) { authenticated_header(user, organization: organization) }

  describe 'POST /api/v1/assessments/:assessment_id/sessions' do
    it 'creates a new candidate session and returns candidate invite url' do
      post "/api/v1/assessments/#{assessment.id}/sessions",
           params: { candidate_name: 'Budi Santoso' }.to_json,
           headers: headers

      expect(response).to have_http_status(:created)
      expect(json_response['session']['candidate_name']).to eq('Budi Santoso')
      expect(json_response['session']['invite_token']).to be_present
      expect(json_response['session']['invite_url']).to include(json_response['session']['invite_token'])
    end
  end

  describe 'GET /api/v1/sessions/:token/candidate' do
    let(:session) { create(:session, assessment: assessment, candidate_name: 'Budi Santoso') }

    it 'returns candidate info without requiring assessor authentication' do
      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      expect(json_response['candidate_name']).to eq('Budi Santoso')
      expect(json_response['assessment_name']).to eq(assessment.name)
    end
  end
end
