# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Sessions Consent API', type: :request do
  let!(:organization) do
    Organization.create!(
      name: 'Rakamin Academy',
      scheme: 'rakamin',
      identifier: 'rakamin-main',
      host: 'rakamin.com',
      config: {}
    )
  end

  let!(:assessment) do
    Assessment.create!(
      tenant_id: organization.id,
      created_by: 1,
      name: 'Senior Fullstack Engineer Interview',
      time_limit_min: 30,
      language: 'en'
    )
  end

  let!(:session_record) do
    Session.create!(
      tenant_id: organization.id,
      assessment_id: assessment.id,
      candidate_name: 'Jane Doe',
      status: 'pending'
    )
  end

  let(:valid_token) { session_record.invite_token }
  let(:invalid_token) { 'invalid_non_existent_token_12345' }

  describe 'POST /api/v1/sessions/:token/consent' do
    let(:consent_payload) do
      {
        version: 'v1.0'
      }.to_json
    end

    context 'when candidate submits valid consent with active token' do
      it 'returns HTTP 200 and records audit trail timestamps in database' do
        post "/api/v1/sessions/#{valid_token}/consent",
             params: consent_payload,
             headers: {
               'Content-Type' => 'application/json',
               'X-Tenant-Scheme' => 'rakamin',
               'User-Agent' => 'RSpec Test Browser / Linux x86_64'
             }

        expect(response).to have_http_status(:ok)
        expect(json[:consented]).to be true
        expect(json[:consent_version]).to eq('v1.0')
        expect(json[:consented_at]).to be_present

        session_record.reload
        expect(session_record.consented_at).to be_within(5.seconds).of(Time.current)
        expect(session_record.consent_version).to eq('v1.0')
        expect(session_record.consent_user_agent).to include('RSpec Test Browser')
        expect(session_record.consented?).to be true
      end
    end

    context 'when candidate provides an invalid or non-existent token' do
      it 'returns HTTP 404 Not Found' do
        post "/api/v1/sessions/#{invalid_token}/consent",
             params: consent_payload,
             headers: { 'Content-Type' => 'application/json', 'X-Tenant-Scheme' => 'rakamin' }

        expect(response).to have_http_status(:not_found)
        expect(response.body).to match(/Invalid or expired invite token/i)
      end
    end

    context 'when session has already ended' do
      before do
        session_record.update!(status: 'ended', end_reason: 'manual_candidate')
      end

      it 'returns HTTP 422 Unprocessable Entity and rejects late consent' do
        post "/api/v1/sessions/#{valid_token}/consent",
             params: consent_payload,
             headers: { 'Content-Type' => 'application/json', 'X-Tenant-Scheme' => 'rakamin' }

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.body).to match(/Session is already ended/i)
      end
    end
  end
end
