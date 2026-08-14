# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AudioWebSocketMiddleware, type: :model do
  let(:org)        { create_organization }
  let(:assessment) { create_assessment(tenant: org) }
  let(:session)    { build_session(tenant: org, assessment: assessment) }
  let(:middleware) { described_class.new(->(_env) { [200, {}, []] }) }

  def authenticate(session_id = session.id)
    session_id = session_id.to_s
    env = Rack::MockRequest.env_for("/ws/sessions/#{session_id}/audio?token=#{session.invite_token}")
    middleware.send(:authenticate_and_load, env, session_id)
  end

  describe '#authenticate_and_load (consent gating)' do
    it 'returns :consent_required when no consent record exists' do
      expect(authenticate).to eq([nil, :consent_required])
    end

    it 'returns :consent_required when consent is pending' do
      create_consent(session: session, status: 'pending')
      expect(authenticate).to eq([nil, :consent_required])
    end

    it 'returns :consent_required when consent is declined' do
      create_consent(session: session, status: 'declined')
      expect(authenticate).to eq([nil, :consent_required])
    end

    it 'returns the session when consent is accepted' do
      create_consent(session: session, status: 'accepted')
      expect(authenticate).to eq([session, nil])
    end

    it 'rejects an ended session before the consent check' do
      session.update!(status: 'ended', end_reason: 'all_covered')
      expect(authenticate).to eq([nil, 'Session has ended'])
    end

    it 'rejects a session id mismatch' do
      create_consent(session: session, status: 'accepted')
      expect(authenticate(session.id + 999)).to eq([nil, 'Session ID mismatch'])
    end

    it 'rejects an unknown token' do
      env = Rack::MockRequest.env_for('/ws/sessions/1/audio?token=does-not-exist')
      expect(middleware.send(:authenticate_and_load, env, '1')).to eq([nil, 'Session not found'])
    end
  end
end
