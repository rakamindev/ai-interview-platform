# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Candidate Consent under UU PDP', type: :request do
  let(:assessment) do
    Assessment.create!(
      name: 'Software Engineer',
      time_limit_min: 30,
      tenant_id: Current.tenant_id,
      created_by: 1
    )
  end

  let(:session) do
    Session.create!(
      assessment: assessment,
      candidate_name: 'Budi Santoso',
      tenant_id: Current.tenant_id,
      status: 'pending'
    )
  end

  describe 'GET /api/v1/sessions/:token/candidate' do
    it 'returns candidate info including consent status' do
      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['candidate_name']).to eq('Budi Santoso')
      expect(json['role_title']).to eq('Software Engineer')
      expect(json['consent_given_at']).to be_nil
    end
  end

  describe 'POST /api/v1/sessions/:token/consent' do
    it 'records candidate explicit consent under UU PDP' do
      post "/api/v1/sessions/#{session.invite_token}/consent",
           params: { consent_version: 'uu_pdp_v1' }.to_json,
           headers: { 'Content-Type' => 'application/json' }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['success']).to be true
      expect(json['consent_given_at']).to be_present

      session.reload
      expect(session.consent_given_at).to be_present
      expect(session.consent_version).to eq('uu_pdp_v1')
    end

    it 'returns 404 for an invalid invite token' do
      post '/api/v1/sessions/invalid_token_123/consent'
      expect(response).to have_http_status(:not_found)
    end
  end
end
