require 'logger'
require 'stringio'
require 'set'
require 'active_support/core_ext/object/blank'
require_relative '../../app/channels/audio_websocket_middleware'

RSpec.describe 'Audio browser lifecycle' do
  let(:middleware) { AudioWebSocketMiddleware.new(nil) }
  let(:state) { AudioWebSocketMiddleware::ConnectionState.new }
  let(:messages) { [] }
  let(:timers) { [] }
  let(:connections) { [] }
  let(:restored_history) { [] }
  let(:session) { double('session', id: 123, ended?: false, active?: true, gemini_resumption_token: 'synthetic-expired', assessment: double(system_prompt: 'Synthetic interview'), transcript_turns: double(ordered: [Struct.new(:speaker, :text).new('ai', 'Explain your previous design.'), Struct.new(:speaker, :text).new('candidate', 'I compared two options.')])) }
  before do
    stub_const('Rails', Module.new); allow(Rails).to receive(:logger).and_return(Logger.new(StringIO.new))
    allow(Time).to receive(:current).and_return(Time.now)
    state.session = session; state.latest_resumption_token = 'synthetic-expired'
    state.instance_variable_set(:@used_resumption_handle, true)
    allow(session).to receive(:update_column)
    allow(middleware).to receive(:send_json) { |_browser, **message| messages << message }
    allow(middleware).to receive(:schedule_proactive_reconnect)
    factory = lambda do |delay, &callback|
      timer = Struct.new(:delay, :callback, :cancelled) do
        def cancel = self.cancelled = true
        def fire; callback.call unless cancelled; end
      end.new(delay, callback, false)
      timers << timer; timer
    end
    allow(EM::Timer).to receive(:new, &factory); allow(EM).to receive(:add_timer, &factory)
    allow(middleware).to receive(:build_gemini_client) do |_browser, current|
      client = double('provider', accepting_audio?: true, inactivity_close: false, connected: true)
      allow(client).to receive(:connect) { |**options| connections << options }
      allow(client).to receive(:restore_context) { |turns| restored_history.concat(turns) }
      allow(client).to receive(:supersede!); allow(client).to receive(:close)
      current.gemini_client = client
    end
    middleware.send(:build_gemini_client, nil, state)
  end
  it 'does not let a detached browser keep reconnecting or schedule a destructive grace timer' do
    event = Struct.new(:code).new(1001)
    middleware.send(:handle_browser_close, event, nil, state, 123)
    expect(state.instance_variable_get(:@detached)).to be(true)
    expect(timers).to be_empty
    middleware.send(:handle_gemini_close, nil, state, code: 1011, reason: 'late close')
    expect(timers).to be_empty
    expect(messages).to be_empty
  end
  it 'cancels queued retry when the old browser detaches' do
    middleware.send(:schedule_gemini_reconnect, nil, state, 1011)
    middleware.send(:handle_browser_close, Struct.new(:code).new(1001), nil, state, 123)
    timers.select { |timer| timer.delay < 5 }.each(&:fire)
    expect(connections).to be_empty
  end
  it 'rebuilds once without reusing an explicitly expired handle and restores persisted conversation' do
    middleware.send(:handle_gemini_close, nil, state, code: 1008, reason: 'BidiGenerateContent session not found or expired')
    timers.each(&:fire)
    expect(connections).to eq([{ resumption_handle: nil }])
    middleware.send(:build_on_ready, nil, state, session).call
    expect(restored_history).to eq([{ role: 'model', parts: [{ text: 'Explain your previous design.' }] }, { role: 'user', parts: [{ text: 'I compared two options.' }] }])
    expect(messages).to include(type: 'speaker_changed', speaker: 'candidate')
  end
  it 'does not allow an expired-handle fallback to create an unlimited reconnect loop' do
    ended = []
    handler = Class.new { define_method(:initialize) { |_session| }; define_method(:call) { |reason:| ended << reason } }
    stub_const('Sessions::EndHandler', handler)
    browser = double('browser', close: nil)
    4.times do
      middleware.send(:handle_gemini_close, browser, state, code: 1008, reason: 'BidiGenerateContent session not found or expired')
      pending = timers.find { |timer| !timer.cancelled }
      if pending
        pending.fire
        pending.cancel
      end
    end
    expect(connections).to eq([{ resumption_handle: nil }] * 3)
    expect(ended).to eq(['error'])
    expect(messages).to include(type: 'session_ended', reason: 'error', message: 'The session encountered a problem. Please contact the interviewer.')
  end

  it 'does not send a ready notification from an obsolete browser connection' do
    middleware.send(:handle_browser_close, Struct.new(:code).new(1001), nil, state, 123)
    middleware.send(:build_on_ready, nil, state, session).call
    expect(messages).to be_empty
  end
  it 'does not restart an active interview beyond its original time limit' do
    ended = []
    handler = Class.new { define_method(:initialize) { |_session| }; define_method(:call) { |reason:| ended << reason } }
    stub_const('Sessions::EndHandler', handler)
    allow(session).to receive(:started_at).and_return(Time.current - 2701)
    allow(session.assessment).to receive(:time_limit_min).and_return(45)
    browser = double('browser', close: nil)
    middleware.send(:connect_to_gemini, browser, state)
    expect(ended).to eq(['time_ceiling'])
    expect(messages).to include(type: 'session_ended', reason: 'time_ceiling')
    expect(connections).to be_empty
  end
  it 'does not erase a handle for an unrelated policy or model error' do
    middleware.send(:handle_gemini_close, nil, state, code: 1008, reason: 'model not supported')
    timers.each(&:fire)
    expect(connections).to eq([{ resumption_handle: 'synthetic-expired' }])
  end
end
