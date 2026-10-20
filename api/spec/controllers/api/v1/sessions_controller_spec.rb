# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Api::V1::SessionsController, type: :controller do
  it 'records acknowledgement of the candidate data notice' do
    session = double('session', status: 'active', ended?: false, privacy_acknowledged_at: nil)
    scope = double('sessions')
    allow(Session).to receive(:unscoped).and_return(scope)
    allow(scope).to receive(:find_by).with(invite_token: 'invite-token').and_return(session)
    expect(session).to receive(:update_column).with(:privacy_acknowledged_at, kind_of(Time))

    post :acknowledge_privacy, params: { token: 'invite-token' }

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to eq('acknowledged' => true)
  end
end

RSpec.describe AudioWebSocketMiddleware do
  it 'blocks a candidate websocket until the privacy notice is acknowledged' do
    session = double('session', id: 7, status: 'active', ended?: false, privacy_acknowledged_at: nil)
    scope = double('sessions')
    middleware = described_class.new(nil)
    allow(Session).to receive(:unscoped).and_return(scope)
    allow(scope).to receive(:find_by).with(invite_token: 'invite-token').and_return(session)
    env = Rack::MockRequest.env_for('/ws/sessions/7/audio?token=invite-token')

    result = middleware.send(:authenticate_and_load, env, '7')

    expect(result).to eq([nil, 'Privacy notice not acknowledged'])
  end
end
