require 'rails_helper'

RSpec.describe 'Candidate invite token expiry', type: :request do
  describe 'GET /api/v1/sessions/:token/candidate' do
    it 'returns session info for a non-expired pending invite' do
      session = create(:session)

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['session_status']).to eq('pending')
    end

    it 'returns 404 with a distinct error code for an expired invite' do
      session = create(:session)

      Timecop.travel(session.invite_expires_at + 1.minute) do
        get "/api/v1/sessions/#{session.invite_token}/candidate"
      end

      expect(response).to have_http_status(:not_found)
      body = JSON.parse(response.body)
      expect(body['errors'].first['code']).to eq('invite_expired')
    end

    it 'returns 404 with a distinct error code for a token that never existed' do
      get '/api/v1/sessions/nonexistent-token/candidate'

      expect(response).to have_http_status(:not_found)
      body = JSON.parse(response.body)
      expect(body['errors'].first['code']).to eq('invite_not_found')
    end

    it 'does not block a session that has already started, even past its expiry time' do
      session = create(:session, status: 'active', started_at: Time.current)

      Timecop.travel(session.invite_expires_at + 1.minute) do
        get "/api/v1/sessions/#{session.invite_token}/candidate"
      end

      expect(response).to have_http_status(:ok)
    end
  end

  describe 'POST /api/v1/sessions/:token/audio_complete' do
    it 'returns 404 with invite_expired code for an expired pending invite' do
      session = create(:session)

      Timecop.travel(session.invite_expires_at + 1.minute) do
        post "/api/v1/sessions/#{session.invite_token}/audio_complete"
      end

      expect(response).to have_http_status(:not_found)
      body = JSON.parse(response.body)
      expect(body['errors'].first['code']).to eq('invite_expired')
    end
  end
end
