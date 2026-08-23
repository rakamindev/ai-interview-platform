# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Rate Limiting (Rack::Attack)', type: :request do
  let(:user) { create(:user, :admin, email: 'admin@test.com', password: 'password123') }
  # Rack::Attack cache is cleared globally in rails_helper before each request spec

  describe 'Auth login rate limit (5 requests/minute per IP)' do
    it 'allows up to 5 login attempts' do
      5.times do
        post '/api/v1/auth/login', params: { email: 'admin@test.com', password: 'wrong' }
        expect(response).not_to have_http_status(:too_many_requests)
      end
    end

    it 'blocks the 6th login attempt within 1 minute' do
      5.times do
        post '/api/v1/auth/login', params: { email: 'admin@test.com', password: 'wrong' }
      end

      post '/api/v1/auth/login', params: { email: 'admin@test.com', password: 'wrong' }

      expect(response).to have_http_status(:too_many_requests)
      expect(json_body['error']).to eq('Too many requests. Please try again later.')
    end

    it 'resets after 1 minute' do
      5.times do
        post '/api/v1/auth/login', params: { email: 'admin@test.com', password: 'wrong' }
      end

      # Wait for throttle window to expire
      Timecop.travel(1.minute + 1.second) do
        post '/api/v1/auth/login', params: { email: 'admin@test.com', password: 'wrong' }
        expect(response).not_to have_http_status(:too_many_requests)
      end
    end
  end

  describe 'Candidate session endpoints rate limit (30 requests/minute per IP)' do
    let(:session) { create(:session, :active) }

    it 'allows up to 30 candidate_info requests' do
      30.times do
        get "/api/v1/sessions/#{session.invite_token}/candidate"
        expect(response).not_to have_http_status(:too_many_requests)
      end
    end

    it 'blocks the 31st candidate_info request within 1 minute' do
      31.times do
        get "/api/v1/sessions/#{session.invite_token}/candidate"
      end

      expect(response).to have_http_status(:too_many_requests)
      expect(json_body['error']).to eq('Too many requests. Please try again later.')
    end

    it 'allows up to 30 audio_complete requests' do
      30.times do
        post "/api/v1/sessions/#{session.invite_token}/audio_complete"
        expect(response).not_to have_http_status(:too_many_requests)
      end
    end

    it 'blocks the 31st audio_complete request within 1 minute' do
      31.times do
        post "/api/v1/sessions/#{session.invite_token}/audio_complete"
      end

      expect(response).to have_http_status(:too_many_requests)
    end
  end

  describe 'Throttled response format' do
    it 'returns JSON with error message' do
      6.times { post '/api/v1/auth/login', params: { email: 'admin@test.com', password: 'wrong' } }

      expect(response.content_type).to include('application/json')
      expect(json_body['error']).to eq('Too many requests. Please try again later.')
    end

    it 'returns 429 status code' do
      6.times { post '/api/v1/auth/login', params: { email: 'admin@test.com', password: 'wrong' } }

      expect(response).to have_http_status(:too_many_requests)
    end
  end

  describe 'Health endpoints are not rate limited' do
    it 'allows unlimited health checks' do
      100.times do
        get '/health'
        expect(response).to have_http_status(:ok)
      end
    end
  end
end