# frozen_string_literal: true

require 'rails_helper'
require 'rack/mock'

RSpec.describe AudioWebsocketMiddleware do
  let(:app) { ->(_env) { [200, {}, []] } }
  let(:middleware) { described_class.new(app) }
  let(:org) { create(:organization, scheme: 'test-corp') }

  def invite_env(token)
    Rack::MockRequest.env_for("/ws/sessions/x/audio?token=#{token}")
  end

  def bearer_env(token)
    Rack::MockRequest.env_for('/ws/sessions/x/audio', 'HTTP_AUTHORIZATION' => "Bearer #{token}")
  end

  it 'accepts a candidate with a usable invite' do
    session = create(:session, tenant_id: org.id, status: 'active')

    result, error = middleware.send(:authenticate_and_load, invite_env(session.invite_token), session.id.to_s)

    expect(error).to be_nil
    expect(result).to eq(session)
  end

  it 'rejects a revoked invite' do
    session = create(:session, tenant_id: org.id, status: 'active', revoked_at: Time.current)

    _result, error = middleware.send(:authenticate_and_load, invite_env(session.invite_token), session.id.to_s)

    expect(error).to eq('Invite link is no longer valid')
  end

  it 'rejects an expired invite' do
    session = create(:session, tenant_id: org.id, status: 'active', expires_at: 1.hour.ago)

    _result, error = middleware.send(:authenticate_and_load, invite_env(session.invite_token), session.id.to_s)

    expect(error).to eq('Invite link is no longer valid')
  end

  it 'rejects a non-assessor JWT on the audio stream' do
    session = create(:session, tenant_id: org.id)
    user_token = JsonWebToken.encode(user_id: 1, role: 'user', scheme: org.scheme)

    _result, error = middleware.send(:authenticate_and_load, bearer_env(user_token), session.id.to_s)

    expect(error).to eq('Forbidden')
  end
end
