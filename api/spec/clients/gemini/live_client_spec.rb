# frozen_string_literal: true

require 'logger'
require 'stringio'
require 'active_support/core_ext/object/blank'
require 'active_support/core_ext/string/filters'
require_relative '../../../app/clients/gemini/live_client'

# Deliberately loads no Rails environment, database, or application credentials.
RSpec.describe Gemini::LiveClient do
  let(:turns) { [] }
  let(:candidate_text) { [] }
  let(:ai_text) { [] }
  let(:timers) { [] }
  let(:closed_connections) { [] }
  let(:client) do
    described_class.new(
      system_prompt: 'Synthetic test interview', api_key: 'test-placeholder', model: 'test-model',
      on_model_turn_complete: -> { turns << :candidate },
      on_input_transcription: ->(text) { candidate_text << text },
      on_output_transcription: ->(text) { ai_text << text }
    )
  end

  before do
    stub_const('Rails', Module.new)
    allow(Rails).to receive(:logger).and_return(Logger.new(StringIO.new))
    timer_factory = lambda do |delay, &callback|
      timer = Struct.new(:delay, :callback, :cancelled) do
        def cancel = self.cancelled = true
        def fire
          callback.call unless cancelled
        end
      end.new(delay, callback, false)
      timers << timer
      timer
    end
    allow(EM::Timer).to receive(:new, &timer_factory)
    allow(EM::PeriodicTimer).to receive(:new, &timer_factory)
  end

  def receive_message(content)
    client.send(:handle_message, { 'serverContent' => content }.to_json)
  end

  def connect_synthetic_wire
    messages = []
    socket = double('synthetic WebSocket', on: nil)
    allow(socket).to receive(:send) { |payload| messages << JSON.parse(payload) }
    allow(socket).to receive(:close) { closed_connections << :closed }
    allow(Faye::WebSocket::Client).to receive(:new).and_return(socket)
    client.connect
    client.send(:handle_message, { 'setupComplete' => {} }.to_json)
    messages
  end

  it 'does not retain a checkpoint explicitly marked non-resumable' do
    connect_synthetic_wire
    client.send(:handle_message, { 'sessionResumptionUpdate' => { 'newHandle' => 'synthetic-obsolete', 'resumable' => false } }.to_json)
    expect(client.resumption_token).to be_nil
  end

  it 'restores role-labelled history without completing a new user turn' do
    messages = connect_synthetic_wire
    turns = [{ role: 'model', parts: [{ text: 'Synthetic prior question' }] }]
    client.restore_context(turns)
    expect(messages.last).to eq('clientContent' => { 'turns' => [{ 'role' => 'model', 'parts' => [{ 'text' => 'Synthetic prior question' }] }], 'turnComplete' => false })
  end
  it 'signals the end of a paused audio stream and accepts the next answer' do
    now = 0.0
    allow(Process).to receive(:clock_gettime).with(Process::CLOCK_MONOTONIC) { now }
    messages = connect_synthetic_wire
    client.send_audio("\x01\x00")

    now = 1.1
    timers.find { |timer| timer.delay == 1 }.fire
    expect(messages.last).to eq('realtimeInput' => { 'audioStreamEnd' => true })
    expect(messages.count { |message| message.dig('realtimeInput', 'audioStreamEnd') }).to eq(1)

    now = 2.0
    client.send_audio("\x02\x00")
    expect(messages.last.dig('realtimeInput', 'audio')).to eq(
      'mimeType' => 'audio/pcm;rate=16000', 'data' => 'AgA='
    )
  end

  it 'waits for a full pause after the most recent audio rather than cutting speech mid-turn' do
    now = 0.0
    allow(Process).to receive(:clock_gettime).with(Process::CLOCK_MONOTONIC) { now }
    messages = connect_synthetic_wire
    client.send_audio("\x01\x00")
    first_pause_timer = timers.find { |timer| timer.delay == 1 }
    now = 0.6
    client.send_audio("\x02\x00")
    now = 1.0
    first_pause_timer.fire
    expect(messages.none? { |message| message.dig('realtimeInput', 'audioStreamEnd') }).to be(true)

    now = 1.7
    timers.last.fire
    expect(messages.last).to eq('realtimeInput' => { 'audioStreamEnd' => true })
  end

  it 'gives Gemini a fresh response timeout after a long candidate answer' do
    now = 0.0
    allow(Process).to receive(:clock_gettime).with(Process::CLOCK_MONOTONIC) { now }
    connect_synthetic_wire
    client.send_audio("\x01\x00")
    pause_timer = timers.find { |timer| timer.delay == 1 }
    now = 35.0
    client.send_audio("\x02\x00")
    now = 36.1
    pause_timer.fire
    watchdog = timers.find { |timer| timer.delay == 10 }
    watchdog.fire
    expect(closed_connections).to be_empty

    now = 67.0
    watchdog.fire
    expect(closed_connections).to eq([:closed])
  end

  it 'returns the microphone to the candidate for a text-only completed model turn' do
    receive_message('outputTranscription' => { 'text' => 'Please continue.' })
    receive_message('turnComplete' => true)

    expect(turns).to eq([:candidate])
    expect(ai_text).to eq(['Please continue.'])
  end

  it 'persists candidate transcription when audio ends without generationComplete' do
    receive_message('inputTranscription' => { 'text' => 'I measured the rendering cost.' })
    receive_message('modelTurn' => { 'parts' => [{ 'inlineData' => {
      'mimeType' => 'audio/pcm;rate=24000', 'data' => Base64.strict_encode64("\x01\x00")
    } }] })
    receive_message('turnComplete' => true)

    expect(candidate_text).to eq(['I measured the rendering cost.'])
    expect(turns).to eq([:candidate])
  end

  it 'opens the microphone only once after the generationComplete drain delay' do
    receive_message('modelTurn' => { 'parts' => [{ 'inlineData' => {
      'mimeType' => 'audio/pcm;rate=24000', 'data' => Base64.strict_encode64("\x01\x00")
    } }] })
    receive_message('generationComplete' => true, 'turnComplete' => true)

    expect(turns).to be_empty
    timers.each(&:fire)
    expect(turns).to eq([:candidate])
  end
end
