require 'logger'
require 'stringio'
require 'active_support/core_ext/object/blank'
require_relative '../../app/channels/audio_websocket_middleware'

RSpec.describe AudioWebSocketMiddleware do
  it 'opens the candidate microphone when a browser resumes an existing session' do
    stub_const('Rails', Module.new)
    allow(Rails).to receive(:logger).and_return(Logger.new(StringIO.new))
    middleware = described_class.new(nil)
    messages = []
    allow(middleware).to receive(:send_json) { |_browser, **message| messages << message }
    allow(middleware).to receive(:schedule_proactive_reconnect)
    state = AudioWebSocketMiddleware::ConnectionState.new
    state.resuming_session = true
    session = double('session', id: 123, gemini_resumption_token: 'synthetic-resumption')
    middleware.send(:build_on_ready, nil, state, session).call
    expect(messages).to include(type: 'speaker_changed', speaker: 'candidate')
    expect(messages).to include(type: 'session_started', session_id: 123)
    expect(state.model_speaking).to be(false)
  end
end
