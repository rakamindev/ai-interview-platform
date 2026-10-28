# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Candidate Session API', type: :request do
  let!(:organization) do
    Organization.create!(
      name: 'Alpha Corp',
      scheme: 'alpha-corp',
      identifier: 'alpha',
      host: 'alpha.example.com'
    )
  end

  let!(:user) do
    User.create!(
      email: 'recruiter@alpha.com',
      password: 'password123',
      password_confirmation: 'password123',
      role: 'admin'
    )
  end

  let!(:assessment) do
    Current.using(tenant_id: organization.id) do
      Assessment.create!(
        name: 'Fullstack Product Engineer',
        time_limit_min: 45,
        created_by: user.id
      )
    end
  end

  let!(:session_record) do
    Current.using(tenant_id: organization.id) do
      Session.create!(
        assessment: assessment,
        candidate_name: 'Budi Santoso'
      )
    end
  end

  describe 'GET /api/v1/sessions/:token/candidate' do
    context 'with a valid invite token' do
      it 'returns 200 with session details and role information' do
        get "/api/v1/sessions/#{session_record.invite_token}/candidate"

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)

        expect(json['session_id']).to eq(session_record.id)
        expect(json['role_title']).to eq('Fullstack Product Engineer')
        expect(json['time_limit_min']).to eq(45)
        expect(json['session_status']).to eq('pending')
      end
    end

    context 'with an invalid invite token' do
      it 'returns 404 Not Found and does not authenticate' do
        get '/api/v1/sessions/non-existent-token-12345/candidate'

        expect(response).to have_http_status(:not_found)
        json = JSON.parse(response.body)
        expect(json['error']).to match(/Invalid or expired/i)
      end
    end

    context 'when the session has ended' do
      before do
        Current.using(tenant_id: organization.id) do
          session_record.update!(status: 'ended', end_reason: 'manual_candidate', ended_at: Time.current)
        end
      end

      it 'returns 200 with session_status as ended' do
        get "/api/v1/sessions/#{session_record.invite_token}/candidate"

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json['session_status']).to eq('ended')
      end
    end
  end

  describe 'POST /api/v1/sessions/:token/consent' do
    context 'with a valid invite token and consent payload' do
      it 'records consented_at timestamp and consent_version' do
        post "/api/v1/sessions/#{session_record.invite_token}/consent",
             params: { consent: { consent_version: 'v1.0-2026' } },
             as: :json

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json['consented']).to be true

        session_record.reload
        expect(session_record.consented_at).to be_present
        expect(session_record.consent_version).to eq('v1.0-2026')
      end
    end

    context 'with an invalid invite token' do
      it 'returns 404 Not Found' do
        post '/api/v1/sessions/invalid-token-xyz/consent',
             params: { consent: { consent_version: 'v1.0-2026' } },
             as: :json

        expect(response).to have_http_status(:not_found)
      end
    end

    context 'when the session has already ended' do
      before do
        Current.using(tenant_id: organization.id) do
          session_record.update!(status: 'ended', end_reason: 'manual_candidate', ended_at: Time.current, consented_at: nil)
        end
      end

      it 'rejects consent with 422 Unprocessable Entity and does not update consent fields' do
        post "/api/v1/sessions/#{session_record.invite_token}/consent",
             params: { consent: { consent_version: 'v1.0-2026' } },
             as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        json = JSON.parse(response.body)
        expect(json['error']).to match(/already ended/i)

        session_record.reload
        expect(session_record.consented_at).to be_nil
      end
    end

    context 'when candidate calls consent repeatedly while active (idempotent)' do
      it 'accepts repeat calls and updates the timestamp' do
        post "/api/v1/sessions/#{session_record.invite_token}/consent",
             params: { consent: { consent_version: 'v1.0-2026' } },
             as: :json
        expect(response).to have_http_status(:ok)

        post "/api/v1/sessions/#{session_record.invite_token}/consent",
             params: { consent: { consent_version: 'v1.1-2026' } },
             as: :json
        expect(response).to have_http_status(:ok)
        session_record.reload
        expect(session_record.consent_version).to eq('v1.1-2026')
      end
    end
  end
end
