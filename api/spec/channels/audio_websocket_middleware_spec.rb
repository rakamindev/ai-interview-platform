# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AudioWebSocketMiddleware do
  let(:app) { ->(env) { [200, { 'Content-Type' => 'text/plain' }, ['OK']] } }
  let(:middleware) { described_class.new(app) }
  let(:organization) { Organization.create!(name: 'Audio Org', scheme: 'audio01', identifier: 'audio01', host: 'audio01.test') }
  let(:assessment) do
    Assessment.create!(
      tenant_id: organization.id,
      created_by: 1,
      name: 'Audio Test',
      time_limit_min: 30,
      system_prompt: 'System prompt'
    )
  end
  let(:session) do
    Session.create!(
      tenant_id: organization.id,
      assessment: assessment,
      invite_token: SecureRandom.hex(16),
      status: :active
    )
  end
  let(:mock_ws) { double('Faye::WebSocket', send: true) }
  let(:state) { AudioWebSocketMiddleware::ConnectionState.new }

  after(:each) do
    AudioWebSocketMiddleware.active_states.clear
    AudioWebSocketMiddleware.active_connections.clear
  end

  describe '#build_on_ready' do
    it 'emits speaker_changed: candidate when resuming an already active session' do
      messages = []
      allow(mock_ws).to receive(:send) do |payload|
        messages << JSON.parse(payload)
      end

      # Session is active and model is not speaking (e.g. candidate refreshed)
      expect(session.active?).to be true
      state.model_speaking = false

      allow(middleware).to receive(:schedule_proactive_reconnect)

      on_ready_cb = middleware.send(:build_on_ready, mock_ws, state, session)
      on_ready_cb.call

      speaker_msg = messages.find { |m| m['type'] == 'speaker_changed' }
      expect(speaker_msg).to be_present
      expect(speaker_msg['speaker']).to eq('candidate')

      session_started_msg = messages.find { |m| m['type'] == 'session_started' }
      expect(session_started_msg).to be_present
      expect(session_started_msg['session_id']).to eq(session.id)
    end

    it 'triggers opening greeting and sets speaker_changed: ai on a fresh start' do
      messages = []
      allow(mock_ws).to receive(:send) do |payload|
        messages << JSON.parse(payload)
      end

      mock_gemini = double('Gemini::LiveClient', trigger_opening: true)
      state.gemini_client = mock_gemini
      state.fresh_start = true

      expect(mock_gemini).to receive(:trigger_opening).once
      allow(middleware).to receive(:schedule_proactive_reconnect)

      on_ready_cb = middleware.send(:build_on_ready, mock_ws, state, session)
      on_ready_cb.call

      speaker_msg = messages.find { |m| m['type'] == 'speaker_changed' }
      expect(speaker_msg).to be_present
      expect(speaker_msg['speaker']).to eq('ai')
      expect(state.fresh_start).to be false
    end
  end

  describe '#handle_browser_open ghost timer cancellation' do
    it 'cancels existing graceful_end_timer on previous state when reconnecting' do
      old_state = AudioWebSocketMiddleware::ConnectionState.new
      old_state.session = session
      mock_timer = double('EM::Timer', cancel: true)
      old_state.graceful_end_timer = mock_timer

      AudioWebSocketMiddleware.active_states[session.id.to_s] = old_state

      expect(mock_timer).to receive(:cancel).once

      new_state = AudioWebSocketMiddleware::ConnectionState.new
      mock_browser_ws = double('Faye::WebSocket', send: true, close: true)

      env = {
        'PATH_INFO' => "/ws/sessions/#{session.id}/audio",
        'rack.input' => StringIO.new,
        'QUERY_STRING' => "token=#{session.invite_token}"
      }

      allow(middleware).to receive(:connect_to_gemini)

      middleware.send(:handle_browser_open, env, session.id.to_s, mock_browser_ws, new_state)

      expect(old_state.graceful_end_timer).to be_nil
      expect(AudioWebSocketMiddleware.active_states[session.id.to_s]).to eq(new_state)
    end
  end

  describe '#ai_closing_detected?' do
    let(:polite_text) { "Thank you for your time explaining your architecture, now let's discuss PostgreSQL." }
    let(:closing_text) { "Thank you for your time today. That concludes our interview, good luck!" }

    it 'does NOT trigger closing on polite phrases during early interview turns' do
      session.update!(started_at: 2.minutes.ago)
      state.coverage_pending = false

      detected = middleware.send(:ai_closing_detected?, polite_text, state, session)
      expect(detected).to be false
    end

    it 'triggers closing when coverage_pending is true' do
      session.update!(started_at: 2.minutes.ago)
      state.coverage_pending = true

      detected = middleware.send(:ai_closing_detected?, closing_text, state, session)
      expect(detected).to be true
    end

    it 'triggers closing when >= 90% of time limit has elapsed' do
      # 30 minute limit: 90% is 27 minutes. Started 28 minutes ago:
      session.update!(started_at: 28.minutes.ago)
      state.coverage_pending = false

      detected = middleware.send(:ai_closing_detected?, closing_text, state, session)
      expect(detected).to be true
    end
  end

  describe '.terminate_session_connections' do
    it 'closes browser websockets and gemini clients on session termination' do
      mock_gemini = double('Gemini::LiveClient', close: true)
      state.gemini_client = mock_gemini
      mock_browser_ws = double('Faye::WebSocket', send: true, close: true)

      AudioWebSocketMiddleware.active_states[session.id.to_s] = state
      AudioWebSocketMiddleware.active_connections[session.id.to_s] = [{ ws: mock_browser_ws, state: state }]

      expect(mock_gemini).to receive(:close).once
      expect(mock_browser_ws).to receive(:send).with(include('session_ended'))

      AudioWebSocketMiddleware.terminate_session_connections(session.id, reason: 'manual_assessor')

      expect(AudioWebSocketMiddleware.active_states[session.id.to_s]).to be_nil
      expect(AudioWebSocketMiddleware.active_connections[session.id.to_s]).to be_empty
    end
  end

  describe '#save_transcript_turn atomic concurrency' do
    it 'persists concurrent turns across multiple parallel threads without RecordNotUnique or drops' do
      threads = []
      turns_count = 10

      turns_count.times do |i|
        threads << Thread.new do
          ActiveRecord::Base.connection_pool.with_connection do
            middleware.send(:save_transcript_turn, session, i + 1, 'candidate', "Turn content #{i}")
          end
        end
      end

      threads.each(&:join)

      saved_turns = session.transcript_turns.order(:turn_number)
      expect(saved_turns.count).to eq(turns_count)
      expect(saved_turns.pluck(:turn_number)).to eq((1..turns_count).to_a)
    end
  end

  describe 'multi-tab zombie teardown (CONC-02)' do
    it 'drops incoming audio frames and closes the socket when the session has ended' do
      session.update!(status: 'ended', end_reason: 'manual_candidate')
      state.session = session
      mock_gemini = double('Gemini::LiveClient', send_audio: true, close: true)
      state.gemini_client = mock_gemini
      mock_browser_ws = double('Faye::WebSocket', send: true, close: true)

      expect(mock_gemini).not_to receive(:send_audio)
      expect(mock_gemini).to receive(:close).once
      expect(mock_browser_ws).to receive(:send).with(include('session_ended'))
      expect(mock_browser_ws).to receive(:close).once

      middleware.send(:forward_audio_frame, 'dummy pcm data', state, session.id, mock_browser_ws)
    end

    it 'tears down all secondary tabs when a session terminates' do
      mock_gemini_tab_a = double('Gemini::LiveClient', close: true)
      mock_gemini_tab_b = double('Gemini::LiveClient', close: true)
      state_tab_a = AudioWebSocketMiddleware::ConnectionState.new
      state_tab_a.session = session
      state_tab_a.gemini_client = mock_gemini_tab_a
      state_tab_b = AudioWebSocketMiddleware::ConnectionState.new
      state_tab_b.session = session
      state_tab_b.gemini_client = mock_gemini_tab_b

      ws_tab_a = double('Faye::WebSocket', send: true, close: true)
      ws_tab_b = double('Faye::WebSocket', send: true, close: true)

      AudioWebSocketMiddleware.active_states[session.id.to_s] = state_tab_a
      AudioWebSocketMiddleware.active_connections[session.id.to_s] = [
        { ws: ws_tab_a, state: state_tab_a },
        { ws: ws_tab_b, state: state_tab_b }
      ]

      expect(ws_tab_a).to receive(:send).with(include('session_ended'))
      expect(ws_tab_b).to receive(:send).with(include('session_ended'))
      expect(mock_gemini_tab_a).to receive(:close).once
      expect(mock_gemini_tab_b).to receive(:close).once

      AudioWebSocketMiddleware.terminate_session_connections(session.id, reason: 'manual_candidate')

      expect(AudioWebSocketMiddleware.active_connections[session.id.to_s]).to be_empty
    end
  end

  describe 'binary PCM frame classification (FRAME-01)' do
    let(:mock_gemini) { double('Gemini::LiveClient', accepting_audio?: true, send_audio: true) }

    before do
      state.session = session
      state.gemini_client = mock_gemini
      state.model_speaking = false
    end

    it 'forwards binary PCM starting with 0x7B as audio and does not parse as JSON' do
      binary_pcm = [0x7B, 0x00, 0x12, 0x34].pack('C*')
      event = double('Faye::WebSocket::Event', data: binary_pcm)

      expect(middleware).not_to receive(:handle_browser_message)
      expect(mock_gemini).to receive(:send_audio).with(binary_pcm)

      middleware.send(:handle_browser_frame, event, mock_ws, state, session.id)
    end

    it 'forwards array byte frames as audio' do
      byte_array = [0x7B, 0x01, 0x02, 0x03]
      event = double('Faye::WebSocket::Event', data: byte_array)

      expect(middleware).not_to receive(:handle_browser_message)
      expect(mock_gemini).to receive(:send_audio).with(byte_array.pack('C*'))

      middleware.send(:handle_browser_frame, event, mock_ws, state, session.id)
    end

    it 'routes UTF-8 text frames to handle_browser_message' do
      json_text = '{"type":"end_session"}'
      event = double('Faye::WebSocket::Event', data: json_text)

      expect(middleware).to receive(:handle_browser_message).with(json_text, mock_ws, state)
      expect(mock_gemini).not_to receive(:send_audio)

      middleware.send(:handle_browser_frame, event, mock_ws, state, session.id)
    end
  end

  describe 'async reactor offloading for GoAway token persistence (EVENT-01)' do
    it 'persists resumption token asynchronously in a background thread' do
      mock_old_gemini = double('Gemini::LiveClient', supersede!: true, close: true)
      mock_new_gemini = double('Gemini::LiveClient', connect: true)
      state.session = session
      state.gemini_client = mock_old_gemini

      allow(middleware).to receive(:build_gemini_client) do
        state.gemini_client = mock_new_gemini
      end

      thread_spawned = false
      allow(Thread).to receive(:new).and_wrap_original do |m, *args, &block|
        thread_spawned = true
        m.call(*args, &block)
      end

      token = 'goaway_token_12345'
      middleware.send(:handle_go_away, mock_ws, state, token)

      expect(thread_spawned).to be true
      expect(state.latest_resumption_token).to eq(token)

      sleep 0.1
      expect(session.reload.gemini_resumption_token).to eq(token)
    end
  end

  describe 'multi-tenant dynamic Gemini client factory (ENH-CFG-02)' do
    it 'passes session tenant organization into Gemini::LiveClient' do
      state.session = session
      mock_gemini = instance_double(Gemini::LiveClient)

      expect(Gemini::LiveClient).to receive(:new).with(
        hash_including(
          organization: organization,
          system_prompt: assessment.system_prompt
        )
      ).and_return(mock_gemini)

      middleware.send(:build_gemini_client, mock_ws, state)
      expect(state.gemini_client).to eq(mock_gemini)
    end
  end
end
