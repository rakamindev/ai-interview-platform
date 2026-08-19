# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Sessions', type: :request do
  let(:org) { Organization.find_by(scheme: 'test-corp') || Organization.create!(name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp', host: 'localhost') }
  let(:headers) { auth_headers(scheme: org.scheme) }
  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      created_by: 1,
      name: 'Product Engineer',
      time_limit_min: 45
    )
  end
  let(:session_record) { Session.create!(tenant_id: org.id, assessment: assessment) }

  describe 'GET /api/v1/sessions/:token/candidate' do
    it 'returns candidate info without requiring JWT authentication' do
      get "/api/v1/sessions/#{session_record.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['role_title']).to eq('Product Engineer')
      expect(json['time_limit_min']).to eq(45)
      expect(json['candidate_consent']).to be false
    end
  end

  describe 'POST /api/v1/sessions/:token/consent' do
    it 'records candidate consent under UU PDP compliance' do
      post "/api/v1/sessions/#{session_record.invite_token}/consent", params: { locale: 'id' }.to_json, headers: { 'Content-Type' => 'application/json' }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['consented']).to be true
      expect(json['consent_locale']).to eq('id')

      expect(session_record.reload.candidate_consent).to be true
    end
  end

  describe 'GET /api/v1/assessments/:assessment_id/sessions' do
    it 'lists sessions for authorized assessor' do
      session_record
      get "/api/v1/assessments/#{assessment.id}/sessions", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['sessions'].length).to eq(1)
    end
  end
end
