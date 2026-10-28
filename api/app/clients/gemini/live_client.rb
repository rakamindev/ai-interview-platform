# frozen_string_literal: true

require 'faye/websocket'
require 'json'
require 'base64'

module Gemini
  # Manages a persistent WebSocket connection to Gemini Live API.
  class LiveClient
    GEMINI_WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'

    INACTIVITY_TIMEOUT = 30 # reconnect if Gemini produces no meaningful response
    GATE_OPEN_DELAY    = 0.8 # delay opening mic gate so frontend audio buffer drains and avoids echo loop

    # The worklet stops sending silence; explicitly finish that input stream after a pause.
    INPUT_PAUSE_SECONDS = 1

    attr_reader :resumption_token, :connected, :connected_at, :inactivity_close

    def initialize(
      system_prompt:,
      api_key: nil,
      model: nil,
      voice: 'Puck',
      on_audio: nil,
      on_input_transcription: nil,
      on_output_transcription: nil,
      on_model_turn_complete: nil,
      on_go_away: nil,
      on_close: nil,
      on_error: nil,
      on_ready: nil,
      on_resumption_token_update: nil
    )
      @system_prompt = system_prompt
      @api_key = api_key || ENV.fetch('GEMINI_API_KEY')
      @model = model || ENV.fetch('GEMINI_LIVE_MODEL', 'gemini-3.1-flash-live-preview')
      @voice = voice
      @resumption_token = nil
      @connected = false
      @ws = nil
      @input_text_buffer  = +''
      @output_text_buffer = +''
      @turn_gate_open = false
      @last_activity_at = nil
      @inactivity_timer = nil
      @last_audio_forwarded_at = nil
      @input_pause_timer = nil

      @on_audio = on_audio
      @on_input_transcription = on_input_transcription
      @on_output_transcription = on_output_transcription
      @on_model_turn_complete = on_model_turn_complete
      @on_go_away = on_go_away
      @on_close = on_close
      @on_error = on_error
      @on_ready = on_ready
      @on_resumption_token_update = on_resumption_token_update
    end

    # Opens the WebSocket and sends setup; resumes a prior session if a handle is provided.
    def connect(resumption_handle: nil)
      @setup_complete = false
      @ws = Faye::WebSocket::Client.new(
        GEMINI_WS_URL,
        nil,
        headers: { 'x-goog-api-key' => @api_key }
      )

      @ws.on(:open)    { |_event| handle_ws_open(resumption_handle) }
      @ws.on(:message) { |event|  handle_message(event.data) }
      @ws.on(:close)   { |event|  handle_ws_close(event) }
      @ws.on(:error)   { |event|  handle_ws_error(event) }

      @ws
    end

    # Sends raw PCM audio bytes to Gemini Live as realtimeInput.
    def send_audio(pcm_bytes)
      return unless @connected && @ws

      ensure_inactivity_watchdog
      track_audio_forwarded(pcm_bytes)
      schedule_input_pause

      @ws.send(audio_message(pcm_bytes))
    end

    # Injects hidden context via realtimeInput.text — same channel as audio, no interleaving conflicts.
    def inject_context(text, turn_complete: true) # turn_complete kept for interface compat, ignored
      return false unless @connected && @ws

      @ws.send({ realtimeInput: { text: text } }.to_json)
      true
    end

    # Restore only persisted turns; do not fabricate candidate answers or start a new greeting.
    def restore_context(turns)
      return false unless @connected && @ws && !@superseded
      @ws.send({ clientContent: { turns: turns, turnComplete: false } }.to_json)
      true
    end

    # Prompts Gemini to speak first via realtimeInput.text.
    def trigger_opening
      return unless @connected && @ws

      @ws.send({ realtimeInput: { text: '[Start the interview. Greet the candidate and ask your first question.]' } }.to_json)
      Rails.logger.info('[Gemini::LiveClient] trigger_opening sent')
    end

    # True when this client is ready to accept audio frames.
    def accepting_audio?
      @connected && @ws && !@superseded
    end

    def waiting_for_response?
      @waiting_for_response
    end

    # Gracefully closes the connection.
    def close
      @inactivity_timer&.cancel
      @gate_timer&.cancel
      cancel_input_pause
      @ws&.close
      @connected = false
    end

    # Silences callbacks before this client is replaced on GoAway reconnect, preventing event bleed.
    def supersede!
      @superseded = true
      @inactivity_timer&.cancel
      @gate_timer&.cancel
      cancel_input_pause
    end

    private

    def handle_ws_open(resumption_handle)
      send_setup(resumption_handle: resumption_handle)
      Rails.logger.info('[Gemini::LiveClient] WebSocket opened — awaiting setupComplete')
    end

    def handle_ws_close(event)
      @connected = false
      Rails.logger.info("[Gemini::LiveClient] Connection closed: code=#{event.code} reason=#{event.reason} superseded=#{@superseded}")
      # Skip on_close for superseded clients to avoid duplicate reconnect from the replaced instance.
      @on_close&.call(code: event.code, reason: event.reason) unless @superseded
    end

    def handle_ws_error(event)
      Rails.logger.error("[Gemini::LiveClient] WebSocket error: #{event.message}")
      @on_error&.call(event.message) unless @superseded
    end

    def activate_connection!
      @connected = true
      Rails.logger.info('[Gemini::LiveClient] Session ready — accepting audio')
      @on_ready&.call
    end

    def record_activity!
      @last_activity_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    end

    def track_audio_forwarded(pcm_bytes)
      @audio_chunks_forwarded = (@audio_chunks_forwarded || 0) + 1
      @audio_bytes_forwarded = (@audio_bytes_forwarded || 0) + pcm_bytes.bytesize
      @last_audio_forwarded_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)

      return unless (@audio_chunks_forwarded % 50).zero?

      Rails.logger.debug(
        "[Gemini::LiveClient] Audio forwarded: #{@audio_chunks_forwarded} chunks (#{@audio_bytes_forwarded}B total)"
      )
    end

    def audio_message(pcm_bytes)
      {
        realtimeInput: {
          audio: {
            mimeType: 'audio/pcm;rate=16000',
            data: Base64.strict_encode64(pcm_bytes)
          }
        }
      }.to_json
    end

    # A timestamp keeps an existing timer from cutting speech when more audio has arrived.
    def schedule_input_pause
      cancel_input_pause if @waiting_for_response

      @last_input_audio_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)

      return if @input_pause_timer

      @input_pause_timer = EM::Timer.new(INPUT_PAUSE_SECONDS) do
        @input_pause_timer = nil
        check_input_pause
      end
    end

    # Verifies real silence elapsed since last audio frame; reschedules if audio arrived during the timer window.
    def check_input_pause
      return if @waiting_for_response || !@connected || !@ws || @superseded || !@last_input_audio_at || @model_emitting_audio

      elapsed = Process.clock_gettime(Process::CLOCK_MONOTONIC) - @last_input_audio_at
      remaining = INPUT_PAUSE_SECONDS - elapsed

      if remaining <= 0.02 # close enough — EM timer precision is ~10ms
        end_input_stream
      else
        @input_pause_timer = EM::Timer.new(remaining) do
          @input_pause_timer = nil
          check_input_pause
        end
      end
    end

    def end_input_stream
      return if @waiting_for_response || !@connected || !@ws || @model_emitting_audio

      @waiting_for_response = true
      # Candidate speech time is not model response time.
      record_activity!
      @ws.send({ realtimeInput: { audioStreamEnd: true } }.to_json)
      Rails.logger.info('[Gemini::LiveClient] Audio stream ended after input pause — waiting for response')
    end

    def cancel_input_pause
      @input_pause_timer&.cancel
      @input_pause_timer = nil
      @last_input_audio_at = nil
      @waiting_for_response = false
    end

    # Reconnect only while waiting for the model, with a fresh timeout after candidate speech.
    def ensure_inactivity_watchdog
      return if @inactivity_timer || @superseded

      record_activity! unless @last_activity_at
      @inactivity_timer = EM::PeriodicTimer.new(10) do
        next unless @connected && @last_activity_at

        now = Process.clock_gettime(Process::CLOCK_MONOTONIC)
        idle = now - @last_activity_at
        next unless @waiting_for_response && idle >= INACTIVITY_TIMEOUT

        Rails.logger.warn("[Gemini::LiveClient] Inactivity detected (#{idle.round(1)}s waiting for response) — forcing reconnect")
        @inactivity_timer&.cancel
        @inactivity_timer = nil
        @inactivity_close = true
        @ws&.close
      end
    end

    def log_gemini_event(data)
      sc = data['serverContent']
      if sc
        has_audio = sc.dig('modelTurn', 'parts')&.any? { |p| p['inlineData'] }
        has_input_tx = sc.key?('inputTranscription')
        has_output_tx = sc.key?('outputTranscription')
        turn_complete = sc['turnComplete']
        gen_complete = sc['generationComplete']
        interrupted = sc['interrupted']

        # Skip audio-only frames (too noisy)
        return if has_audio && !has_input_tx && !has_output_tx && !turn_complete && !gen_complete && !interrupted

        parts = []
        parts << 'interrupted' if interrupted
        parts << 'audio' if has_audio
        if has_input_tx
          input_tx_text = sc.dig('inputTranscription', 'parts', 0, 'text') || sc.dig('inputTranscription', 'text')
          parts << "inputTx=#{input_tx_text.truncate(50)}" if input_tx_text.present?
        end
        if has_output_tx
          output_tx_text = sc.dig('outputTranscription', 'parts', 0, 'text') || sc.dig('outputTranscription', 'text')
          parts << "outputTx=#{output_tx_text.truncate(50)}" if output_tx_text.present?
        end
        parts << 'turnComplete' if turn_complete
        parts << 'generationComplete' if gen_complete

        Rails.logger.info("[Gemini::LiveClient] Event: #{parts.join(' | ')}") if parts.any?
      end

      Rails.logger.info('[Gemini::LiveClient] Event: setupComplete') if data['setupComplete']
      return unless data['sessionResumption'] || data['sessionResumptionUpdate']

      Rails.logger.info('[Gemini::LiveClient] Event: resumptionToken updated')
    end

    def send_setup(resumption_handle: nil)
      setup = {
        setup: {
          model: "models/#{@model}",
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: @voice }
              }
            }
          },
          systemInstruction: {
            parts: [{ text: @system_prompt }]
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          contextWindowCompression: {
            slidingWindow: {}
          }
        }
      }

      # sessionResumption must be present on initial connection or Gemini never sends update handles.
      setup[:setup][:sessionResumption] = resumption_handle.present? ? { handle: resumption_handle } : {}

      @ws.send(setup.to_json)
    end

    def handle_message(raw_data)
      return if @superseded

      data = JSON.parse(raw_data)

      # Only meaningful responses count as activity; token updates do not (they fire even when Gemini stalls).
      record_activity! if data['serverContent'] || data['setupComplete']

      log_gemini_event(data)

      handle_audio_response(data)
      handle_input_transcription(data)
      handle_output_transcription(data)
      handle_generation_complete(data)
      handle_interrupted(data)
      handle_turn_complete(data)
      handle_resumption_update(data)
      handle_setup_complete(data)
      handle_go_away_event(data)
    rescue JSON::ParserError => e
      Rails.logger.error("[Gemini::LiveClient] Failed to parse message: #{e.message}")
    end

    def handle_audio_response(data)
      parts = data.dig('serverContent', 'modelTurn', 'parts')
      return unless parts

      parts.each do |part|
        next unless (inline = part['inlineData'])

        @turn_gate_open = false
        cancel_input_pause unless @model_emitting_audio
        @model_emitting_audio = true
        audio_bytes = Base64.strict_decode64(inline['data'])
        @on_audio&.call(audio_bytes)
      end
    end

    def handle_input_transcription(data)
      input_tx = data.dig('serverContent', 'inputTranscription')
      return unless input_tx

      text = input_tx.dig('parts', 0, 'text') || input_tx['text']
      @input_text_buffer << text.to_s
    end

    def handle_output_transcription(data)
      output_tx = data.dig('serverContent', 'outputTranscription')
      return unless output_tx

      text = output_tx.dig('parts', 0, 'text') || output_tx['text']
      @turn_gate_open = false if text.present?
      @output_text_buffer << text.to_s
    end

    # Must run before turnComplete handling — both can arrive in the same message and order matters.
    # Flushes transcription immediately but delays gate open by GATE_OPEN_DELAY so the speaker drains and avoids echo.
    def handle_generation_complete(data)
      return unless data.dig('serverContent', 'generationComplete')

      emitted_audio = @model_emitting_audio
      @model_emitting_audio = false

      flush_input_buffer
      flush_output_buffer

      if emitted_audio
        @gate_timer&.cancel
        @gate_timer = EM::Timer.new(GATE_OPEN_DELAY) do
          @gate_timer = nil
          unless @superseded
            Rails.logger.info('[Gemini::LiveClient] Gate open — firing on_model_turn_complete')
            open_turn_gate
          end
        end
      else
        Rails.logger.debug('[Gemini::LiveClient] Empty generationComplete (0 audio)')
        open_turn_gate
      end
    end

    # Open gate immediately on candidate barge-in — they're actively speaking so echo risk is moot.
    def handle_interrupted(data)
      return unless data.dig('serverContent', 'interrupted') && @model_emitting_audio

      @model_emitting_audio = false
      @model_interrupted = true
      @gate_timer&.cancel
      @gate_timer = nil
      Rails.logger.info('[Gemini::LiveClient] Model interrupted — resetting audio gate immediately')
      flush_output_buffer
      open_turn_gate
    end

    def handle_turn_complete(data)
      return unless data.dig('serverContent', 'turnComplete')

      # turnComplete ends the MODEL turn, including turns with no audio or generationComplete.
      @model_emitting_audio = false
      @model_interrupted = false
      cancel_input_pause
      flush_input_buffer
      flush_output_buffer
      open_turn_gate unless @gate_timer
    end

    def open_turn_gate
      return if @turn_gate_open || @superseded

      @turn_gate_open = true
      @on_model_turn_complete&.call
    end

    def handle_resumption_update(data)
      resumption = data['sessionResumption'] || data['sessionResumptionUpdate']
      return unless resumption

      if resumption['resumable'] == false
        @resumption_token = nil
        @on_resumption_token_update&.call(nil)
        return
      end
      handle = resumption['newHandle'] || resumption['handle'] || resumption['token']
      return unless handle.present?

      @resumption_token = handle
      @on_resumption_token_update&.call(handle)
    end

    # Session resumption is not a handshake — if a handle was sent, the session is already resumed at setupComplete.
    def handle_setup_complete(data)
      return unless data['setupComplete']

      @setup_complete = true
      @connected_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      activate_connection!
    end

    def handle_go_away_event(data)
      return unless data['goAway']

      time_left = data.dig('goAway', 'timeLeft')
      Rails.logger.warn("[Gemini::LiveClient] GoAway received, timeLeft=#{time_left}")
      @on_go_away&.call(time_left: time_left, resumption_token: @resumption_token)
    end

    def flush_input_buffer
      return unless @input_text_buffer.present?

      @on_input_transcription&.call(@input_text_buffer.strip)
      @input_text_buffer = +''
    end

    def flush_output_buffer
      return unless @output_text_buffer.present?

      @on_output_transcription&.call(@output_text_buffer.strip)
      @output_text_buffer = +''
    end
  end
end
