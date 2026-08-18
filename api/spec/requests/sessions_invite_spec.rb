# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Session invite create/revoke', type: :request do
  let(:tenant_id) { 9_002 }
  let(:assessment) do
    create_assessment!(tenant_id: tenant_id).tap { |a| a.update!(name: 'Invite API assessment') }
  end

  before { stub_assessor_auth!(tenant_id: tenant_id) }

  def create_pending!(attrs = {})
    assessment.sessions.create!(
      {
        tenant_id: tenant_id,
        status: 'pending',
        candidate_name: 'Grace Hopper'
      }.merge(attrs)
    )
  end

  describe 'POST /api/v1/assessments/:assessment_id/sessions' do
    it 'reuses an existing pending invite and returns reused: true' do
      existing = create_pending!(candidate_name: 'Grace Hopper')

      expect do
        post "/api/v1/assessments/#{assessment.id}/sessions",
             params: { session: { candidate_name: 'grace hopper' } },
             as: :json
      end.not_to change(Session, :count)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['reused']).to eq(true)
      expect(body.dig('session', 'id')).to eq(existing.id)
      expect(body['invite_url']).to eq(existing.invite_url)
    end

    it 'creates a new invite when none is pending for that person' do
      expect do
        post "/api/v1/assessments/#{assessment.id}/sessions",
             params: { session: { candidate_name: 'New Candidate' } },
             as: :json
      end.to change(Session, :count).by(1)

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body['reused']).to be_nil
      expect(body.dig('session', 'candidate_name')).to eq('New Candidate')
      expect(body.dig('session', 'status')).to eq('pending')
    end
  end

  describe 'DELETE /api/v1/sessions/:id' do
    it 'revokes a pending invite' do
      pending_invite = create_pending!

      delete "/api/v1/sessions/#{pending_invite.id}", as: :json

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)['message']).to match(/revoked/i)
      expect(Session.find_by(id: pending_invite.id)).to be_nil
    end

    it 'rejects revoke when the session is no longer pending' do
      active = create_pending!(status: 'active', started_at: Time.current)

      expect do
        delete "/api/v1/sessions/#{active.id}", as: :json
      end.not_to change(Session, :count)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body).dig('errors', 0, 'message')).to match(/awaiting invites/i)
    end
  end
end
