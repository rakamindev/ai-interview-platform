# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Sessions (candidate-facing)' do
  let(:org) { create(:organization) }
  let(:assessment) { with_tenant(org) { create(:assessment) } }

  context 'POST /api/v1/sessions/:token/audio_complete' do
    let(:session) { with_tenant(org) { create(:session, assessment: assessment, status: 'pending') } }

    it 'refuses to end a session that never started (empty transcript protection)' do
      post "/api/v1/sessions/#{session.invite_token}/audio_complete"

      expect(response).to have_http_status(:unprocessable_entity)
      expect(session.reload).to be_pending
      expect(PortfolioGeneratorWorker.jobs).to be_empty
    end

    context 'when the session is active' do
      let(:session) { with_tenant(org) { create(:session, assessment: assessment, status: 'active', started_at: 5.minutes.ago) } }

      it 'ends it as all_covered and is idempotent' do
        post "/api/v1/sessions/#{session.invite_token}/audio_complete"
        expect(response).to have_http_status(:ok)
        expect(session.reload.end_reason).to eq('all_covered')

        post "/api/v1/sessions/#{session.invite_token}/audio_complete"
        expect(response).to have_http_status(:ok)
        expect(PortfolioGeneratorWorker.jobs.size).to eq(1)
      end
    end
  end

  context 'POST /api/v1/sessions/:token/consent' do
    let(:session) { with_tenant(org) { create(:session, assessment: assessment, status: 'pending') } }

    it 'records consent on the session (UU PDP) and is idempotent' do
      post "/api/v1/sessions/#{session.invite_token}/consent"
      expect(response).to have_http_status(:ok)
      expect(session.reload.consent_recorded_at).not_to be_nil

      first = session.reload.consent_recorded_at
      post "/api/v1/sessions/#{session.invite_token}/consent"
      expect(session.reload.consent_recorded_at).to eq(first)
    end

    it 'rejects an unknown token' do
      post '/api/v1/sessions/nonexistent-token/consent'
      expect(response).to have_http_status(:not_found)
    end
  end
end