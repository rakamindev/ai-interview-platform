# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Sessions', type: :request do
  let(:assessment) { create(:assessment) }

  describe 'GET /api/v1/sessions/:token/candidate' do
    context 'when the interview link is active and valid' do
      let(:session) { create(:session, assessment: assessment, expires_at: 5.minutes.from_now, status: 'pending') }

      it 'returns HTTP 200 with assessment and session details' do
        get "/api/v1/sessions/#{session.invite_token}/candidate"

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)

        expect(json['session_id']).to eq(session.id)
        expect(json['role_title']).to eq(assessment.name)
        expect(json['session_status']).to eq('pending')
        expect(json['expires_at']).to be_present
      end
    end

    context 'when the interview link has expired' do
      let(:session) { create(:session, assessment: assessment, expires_at: 1.minute.ago, status: 'pending') }

      it 'returns HTTP 410 Gone with link_expired error' do
        get "/api/v1/sessions/#{session.invite_token}/candidate"

        expect(response).to have_http_status(:gone)
        json = JSON.parse(response.body)

        expect(json['error']).to eq('link_expired')
        expect(json['message']).to include('expired')
        expect(session.reload.status).to eq('expired')
      end
    end

    context 'when the session has already ended' do
      let(:session) { create(:session, :ended, assessment: assessment) }

      it 'returns HTTP 403 Forbidden with session_ended error' do
        get "/api/v1/sessions/#{session.invite_token}/candidate"

        expect(response).to have_http_status(:forbidden)
        json = JSON.parse(response.body)

        expect(json['error']).to eq('session_ended')
      end
    end

    context 'when the token is invalid' do
      it 'returns HTTP 404 Not Found' do
        get '/api/v1/sessions/non_existent_token_123/candidate'

        expect(response).to have_http_status(:not_found)
      end
    end
  end
end
