# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Sessions', type: :request do
  describe 'GET /api/v1/sessions/:token/candidate' do
    it 'returns the interview details for a pending invite' do
      session = create(:session)

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body.fetch('session_id')).to eq(session.id)
      expect(body.fetch('session_status')).to eq('pending')
      expect(body.fetch('interview_started')).to be(false)
      expect(body.fetch('end_reason')).to be_nil
    end

    it 'reports an ended interview with its end reason' do
      session = create(:session, :ended, end_reason: 'all_covered')

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body.fetch('session_status')).to eq('ended')
      expect(body.fetch('interview_started')).to be(true)
      expect(body.fetch('end_reason')).to eq('all_covered')
    end

    it 'returns 404 for an unknown invite token' do
      get '/api/v1/sessions/not-a-real-token/candidate'

      expect(response).to have_http_status(:not_found)
    end
  end
end
