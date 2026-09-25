require 'rails_helper'

RSpec.describe 'WebSocket authorization' do
  it 'rejects non-assessor JWTs on both channels' do
    org = organization
    session = assessment_session(org, status: 'active')
    token = JsonWebToken.encode(user_id: 1, role: 'user', scheme: org.scheme)
    coverage = CoverageWebSocketMiddleware.new(nil)
    expect(coverage.send(:authenticate_assessor_by_token, token, session.id)).to eq([nil, 'Assessor role required'])
    env = Rack::MockRequest.env_for("/ws/sessions/#{session.id}/audio", 'HTTP_AUTHORIZATION' => "Bearer #{token}")
    audio = AudioWebSocketMiddleware.new(nil)
    expect(audio.send(:authenticate_and_load, env, session.id.to_s)).to eq([nil, 'Assessor role required'])
  end
end

RSpec.describe AudioWebSocketMiddleware do
  it 'preserves an invite and reports a configuration failure without retrying' do
    session = assessment_session(organization, status: 'active')
    state = described_class::ConnectionState.new
    state.session = session
    state.gemini_client = instance_double(Gemini::LiveClient, inactivity_close: false)
    browser = instance_double(Faye::WebSocket)
    allow(browser).to receive(:send)
    allow(browser).to receive(:close)
    middleware = described_class.new(nil)

    expect(middleware).not_to receive(:schedule_gemini_reconnect)
    middleware.send(:handle_gemini_close, browser, state,
                    code: 1007, reason: 'API key not valid. Please pass a valid API key.')

    expect(session.reload).to be_pending
    expect(session.started_at).to be_nil
    expect(session.portfolio).to be_nil
    expect(browser).to have_received(:send).with(include('interview_service_unavailable'))
    expect(browser).to have_received(:close)
  end

  it 'classifies invalid API keys and invalid models as configuration errors' do
    middleware = described_class.new(nil)
    expect(middleware.send(:gemini_configuration_error?, 1007, 'API key not valid')).to be(true)
    expect(middleware.send(:gemini_configuration_error?, 1007, 'Model is not found')).to be(true)
    expect(middleware.send(:gemini_configuration_error?, 1011, 'temporary outage')).to be(false)
  end
end
