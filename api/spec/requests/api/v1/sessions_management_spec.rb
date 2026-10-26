# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Candidate Session Management (Edit & Revoke)', type: :request do
  let(:org) do
    Organization.find_by(scheme: 'demo') ||
      Organization.create!(name: 'Demo Org', scheme: 'demo', identifier: 'demo', host: 'localhost')
  end

  let(:assessment) do
    Assessment.create!(
      name: 'Backend Screening',
      time_limit_min: 30,
      tenant_id: org.id,
      created_by: 1
    )
  end

  let(:session) do
    Session.create!(
      assessment: assessment,
      candidate_name: 'Joko Santoso',
      tenant_id: org.id,
      status: 'pending'
    )
  end

  let(:headers) { auth_headers(user_id: 1, role: 'admin', scheme: 'demo') }

  describe 'PATCH /api/v1/sessions/:id' do
    it 'updates the candidate name successfully' do
      patch "/api/v1/sessions/#{session.id}",
            params: { session: { candidate_name: 'Joko Santoso, S.Kom' } }.to_json,
            headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json.dig('session', 'candidate_name')).to eq('Joko Santoso, S.Kom')

      session.reload
      expect(session.candidate_name).to eq('Joko Santoso, S.Kom')
    end

    it 'returns unauthorized when no auth token is provided' do
      patch "/api/v1/sessions/#{session.id}",
            params: { session: { candidate_name: 'Hacker' } }.to_json,
            headers: { 'X-Tenant-Scheme' => 'demo' }

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe 'DELETE /api/v1/sessions/:id' do
    it 'revokes and deletes a pending session' do
      delete "/api/v1/sessions/#{session.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(Session.find_by(id: session.id)).to be_nil
    end

    it 'prevents revoking an active in-progress session' do
      session.update!(status: 'active')

      delete "/api/v1/sessions/#{session.id}", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      error_message = json.dig('errors', 0, 'message') || json['error']
      expect(error_message).to include('Cannot revoke an active in-progress session')
      expect(Session.find_by(id: session.id)).to be_present
    end
  end
end
