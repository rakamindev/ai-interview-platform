# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Candidate Session Identity & UU PDP Consent', type: :request do
  let!(:org) do
    Organization.create!(
      name: 'Acme Corp',
      scheme: 'acme-corp',
      identifier: 'acme-corp',
      host: 'acme.test',
      config: {}
    )
  end

  let!(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      created_by: 1,
      name: 'Fullstack Product Engineer',
      time_limit_min: 45
    )
  end

  let!(:candidate_session) do
    Session.create!(
      tenant_id: org.id,
      assessment: assessment,
      status: 'pending',
      candidate_name: 'Budi Santoso'
    )
  end

  describe 'GET /api/v1/sessions/:token/candidate' do
    it 'returns candidate name, assessment title, and initial consent status' do
      get "/api/v1/sessions/#{candidate_session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['candidate_name']).to eq('Budi Santoso')
      expect(json['role_title']).to eq('Fullstack Product Engineer')
      expect(json['time_limit_min']).to eq(45)
      expect(json['consent_given']).to be false
    end

    it 'returns 404 for an invalid invite token' do
      get '/api/v1/sessions/invalid_token_xyz/candidate'

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'PATCH /api/v1/sessions/:token/candidate' do
    it 'allows candidate to correct their misspelled name and record consent' do
      patch "/api/v1/sessions/#{candidate_session.invite_token}/candidate",
            params: { candidate_name: 'Budi Santoso, S.Kom', consent: true }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['candidate_name']).to eq('Budi Santoso, S.Kom')
      expect(json['consent_given']).to be true

      candidate_session.reload
      expect(candidate_session.candidate_name).to eq('Budi Santoso, S.Kom')
      expect(candidate_session.consent_at).to be_present
    end

    it 'rejects updates on already ended sessions' do
      candidate_session.update!(status: 'ended')

      patch "/api/v1/sessions/#{candidate_session.invite_token}/candidate",
            params: { candidate_name: 'Another Name' }

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
