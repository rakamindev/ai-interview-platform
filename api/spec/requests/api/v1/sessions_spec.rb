require 'rails_helper'

RSpec.describe 'Api::V1::Sessions', type: :request do
  let(:assessment) { create(:assessment, time_limit_min: 45) }
  let(:session_obj) { create(:session, assessment: assessment) }

  # Assume standard Rails mock setup for authentication if needed
  # Since authorize_auth_token! relies on decoded_token, we can mock current_tenant_id and auth.
  let(:headers) do
    { 'X-Tenant-Scheme' => 'test-corp', 'Content-Type' => 'application/json' }
  end

  before do
    allow_any_instance_of(ApplicationController).to receive(:require_tenant!).and_return(true)
    allow_any_instance_of(ApplicationController).to receive(:current_tenant_id).and_return(1)
    allow_any_instance_of(AuthorizeApiRequest).to receive(:call).and_return({ user: create(:user, :admin) })
  end

  describe 'GET /api/v1/assessments/:id/sessions' do
    it 'returns sessions for the assessment' do
      session_obj # create it
      get "/api/v1/assessments/#{assessment.id}/sessions", headers: headers
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json['sessions'].length).to eq(1)
    end
  end

  describe 'POST /api/v1/assessments/:id/sessions' do
    it 'creates a session correctly' do
      payload = { session: { candidate_name: 'Jane Doe' } }
      post "/api/v1/assessments/#{assessment.id}/sessions", params: payload.to_json, headers: headers
      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json['session']['candidate_name']).to eq('Jane Doe')
      expect(json['invite_url']).to be_present
    end
  end

  describe 'GET /api/v1/sessions/:id' do
    it 'returns the session details' do
      get "/api/v1/sessions/#{session_obj.id}", headers: headers
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json['session']['id']).to eq(session_obj.id)
      expect(json['session']['assessment']).to be_present
    end
  end

  describe 'GET /sessions/:token/candidate' do
    it 'returns candidate info using invite token' do
      get "/api/v1/sessions/#{session_obj.invite_token}/candidate", headers: headers
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json['session_id']).to eq(session_obj.id)
      expect(json['role_title']).to eq(assessment.name)
    end
  end
end
