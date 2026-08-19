require 'rails_helper'
require 'rack/test'

RSpec.describe AudioWebSocketMiddleware do
  let(:middleware) { described_class.new(nil) }

  def rack_env_with_token(token)
    Rack::MockRequest.env_for("/ws/sessions/1/audio", params: { token: token })
  end

  describe '#authenticate_and_load (invite-token path)' do
    it 'loads the session for a valid, non-expired invite token' do
      session = create(:session)

      loaded, error = middleware.send(:authenticate_and_load, rack_env_with_token(session.invite_token), session.id.to_s)

      expect(error).to be_nil
      expect(loaded.id).to eq(session.id)
    end

    it 'rejects with an error for an expired invite token' do
      session = create(:session)

      Timecop.travel(session.invite_expires_at + 1.minute) do
        loaded, error = middleware.send(:authenticate_and_load, rack_env_with_token(session.invite_token), session.id.to_s)

        expect(loaded).to be_nil
        expect(error).to eq('Invite has expired')
      end
    end

    it 'does not reject an already-active session past its expiry time (AC-3)' do
      session = create(:session, status: 'active', started_at: Time.current)

      Timecop.travel(session.invite_expires_at + 1.minute) do
        loaded, error = middleware.send(:authenticate_and_load, rack_env_with_token(session.invite_token), session.id.to_s)

        expect(error).to be_nil
        expect(loaded.id).to eq(session.id)
      end
    end
  end
end
