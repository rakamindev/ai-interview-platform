require 'rails_helper'

RSpec.describe 'Interview connection recovery' do
  let(:middleware) { AudioWebSocketMiddleware.new(nil) }
  let(:browser) { double('browser', send: true, close: true) }

  [1007, 1008].each do |code|
    it "preserves an unused invite for configuration close #{code}" do
      session = assessment_session(organization, status: 'active')
      state = AudioWebSocketMiddleware::ConnectionState.new
      state.session = session
      state.gemini_client = double(inactivity_close: false)
      expect(middleware).not_to receive(:schedule_gemini_reconnect)
      middleware.send(:handle_gemini_close, browser, state, code: code,
                      reason: 'Request had invalid authentication credentials')
      expect(session.reload).to be_pending
      expect(session.portfolio).to be_nil
      expect(PortfolioGeneratorWorker.jobs).to be_empty
      expect(browser).to have_received(:send).with(include('interview_service_unavailable'))
    end
  end

  it 'still retries temporary upstream failures' do
    state = AudioWebSocketMiddleware::ConnectionState.new
    state.session = assessment_session(organization, status: 'active')
    expect(middleware).to receive(:schedule_gemini_reconnect).with(browser, state, 1011)
    middleware.send(:handle_gemini_close, browser, state, code: 1011, reason: 'temporary outage')
  end

  it 'closes the old client without scheduling termination of a resumed interview' do
    state = AudioWebSocketMiddleware::ConnectionState.new
    state.session = assessment_session(organization, status: 'active')
    state.gemini_client = double(supersede!: true, close: true)
    expect(EM::Timer).not_to receive(:new)
    middleware.send(:handle_browser_close, double(code: 1006), browser, state, state.session.id)
    expect(state.closed).to be(true)
    expect(state.session.reload).to be_active
    expect(state.gemini_client).to have_received(:supersede!)
    expect(state.gemini_client).to have_received(:close)
    expect(middleware).not_to receive(:schedule_gemini_reconnect)
    middleware.send(:handle_gemini_close, browser, state, code: 1011, reason: 'stale callback')
  end

  it 'authenticates Live through the documented query parameter, safely encoded' do
    socket = double(on: true)
    expect(Faye::WebSocket::Client).to receive(:new).with(
      "#{Gemini::LiveClient::GEMINI_WS_URL}?key=test%2Bkey%26value"
    ).and_return(socket)
    Gemini::LiveClient.new(system_prompt: 'Test', api_key: 'test+key&value').connect
  end
end

RSpec.describe 'Audio frame routing' do
  it 'forwards binary PCM even when the first byte is an opening brace' do
    middleware = AudioWebSocketMiddleware.new(nil)
    client = double(accepting_audio?: true, send_audio: true)
    state = AudioWebSocketMiddleware::ConnectionState.new
    state.gemini_client = client
    pcm = "{\x00\x01\x00".b
    middleware.send(:handle_browser_frame, double(data: pcm), double, state, 1)
    expect(client).to have_received(:send_audio).with(pcm)
  end
end

RSpec.describe Gemini::LiveClient do
  it 'reports a setup timeout and suppresses the later close callback' do
    callback = nil
    timer = double(cancel: true)
    allow(EM::Timer).to receive(:new) { |_seconds, &block| callback = block; timer }
    socket = double(on: true, close: true)
    allow(Faye::WebSocket::Client).to receive(:new).and_return(socket)
    events = []
    client = described_class.new(system_prompt: 'Test', api_key: 'synthetic',
                                 on_close: ->(**event) { events << event })
    client.connect
    callback.call
    client.send(:handle_ws_close, double(code: 1000, reason: 'closed'))
    expect(events).to eq([{ code: 1011, reason: 'Setup timed out' }])
    expect(socket).to have_received(:close)
  end
end
