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

    # Silence pump: synthetic silent PCM frames sent during browser silence so Gemini's VAD detects end-of-speech.
    SILENCE_PUMP_DELAY    = 1
    SILENCE_PUMP_INTERVAL = 0.03
    SILENCE_FRAME_SAMPLES = 640
    SILENCE_FRAME = ("\x00" * (SILENCE_FRAME_SAMPLES * 2)).freeze

    attr_reader :resumption_token, :connected, :connected_at, :inactivity_close

    def initialize(
      system_prompt:,
      api_key: nil,
      model: nil,
      voice: 'Puck',
      on_audio: nil,
      on_input_transcription: nil,
      on_output_transcription: nil,
      on_input_transcription_partial: nil,
      on_output_transcription_partial: nil,
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
      @last_input_partial = ''
      @last_output_partial = ''
      @last_activity_at = nil
      @inactivity_timer = nil
      @last_audio_forwarded_at = nil
      @silence_pump_timer = nil

      @on_audio = on_audio
      @on_input_transcription = on_input_transcription
      @on_output_transcription = on_output_transcription
      @on_input_transcription_partial = on_input_transcription_partial
      @on_output_transcription_partial = on_output_transcription_partial
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
      schedule_silence_pump

      @ws.send(audio_message(pcm_bytes))
    end

    # Injects hidden context via realtimeInput.text — same channel as audio, no interleaving conflicts.
    def inject_context(text, turn_complete: true) # turn_complete kept for interface compat, ignored
      return false unless @connected && @ws

      @ws.send({ realtimeInput: { text: text } }.to_json)
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

    def silence_pumping?
      @silence_pumping
    end

    # Gracefully closes the connection.
    def close
      @inactivity_timer&.cancel
      @gate_timer&.cancel
      stop_silence_pump
      @ws&.close
      @connected = false
    end

    # Silences callbacks before this client is replaced on GoAway reconnect, preventing event bleed.
    def supersede!
      @superseded = true
      @inactivity_timer&.cancel
      @gate_timer&.cancel
      stop_silence_pump
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

    # Fire-once timer + timestamp avoids EM reactor churn and premature pump firing during intra-sentence pauses.
    def schedule_silence_pump
      stop_silence_pump if @silence_pumping

      @last_real_audio_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)

      return if @silence_pump_timer

      @silence_pump_timer = EM::Timer.new(SILENCE_PUMP_DELAY) do
        @silence_pump_timer = nil
        check_silence_pump_ready
      end
    end

    # Verifies real silence elapsed since last audio frame; reschedules if audio arrived during the timer window.
    def check_silence_pump_ready
      return if @silence_pumping || !@connected || !@ws || @superseded || !@last_real_audio_at || @model_emitting_audio

      elapsed = Process.clock_gettime(Process::CLOCK_MONOTONIC) - @last_real_audio_at
      remaining = SILENCE_PUMP_DELAY - elapsed

      if remaining <= 0.02 # close enough — EM timer precision is ~10ms
        start_silence_pump
      else
        @silence_pump_timer = EM::Timer.new(remaining) do
          @silence_pump_timer = nil
          check_silence_pump_ready
        end
      end
    end

    def start_silence_pump
      return if @silence_pumping || !@connected || !@ws || @model_emitting_audio

      @silence_pumping = true
      Rails.logger.info('[Gemini::LiveClient] Silence pump started — no real audio for 500ms')

      silence_msg = {
        realtimeInput: {
          audio: {
            mimeType: 'audio/pcm;rate=16000',
            data: Base64.strict_encode64(SILENCE_FRAME)
          }
        }
      }.to_json.freeze

      # Pump until: real audio arrives, Gemini responds (turnComplete), or connection closes/supersedes.
      @silence_pump_periodic = EM::PeriodicTimer.new(SILENCE_PUMP_INTERVAL) do
        if !@connected || !@ws || @superseded
          stop_silence_pump
        else
          @ws.send(silence_msg)
        end
      end
    end

    def stop_silence_pump
      @silence_pump_timer&.cancel
      @silence_pump_timer = nil
      @last_real_audio_at = nil
      @silence_pump_periodic&.cancel
      @silence_pump_periodic = nil
      @silence_pumping = false
    end

    # Triggers reconnect only when silence is being pumped, so a long candidate monologue doesn't kill the connection.
    def ensure_inactivity_watchdog
      return if @inactivity_timer || @superseded

      record_activity! unless @last_activity_at
      @inactivity_timer = EM::PeriodicTimer.new(10) do
        next unless @connected && @last_activity_at

        now = Process.clock_gettime(Process::CLOCK_MONOTONIC)
        idle = now - @last_activity_at
        next unless @silence_pumping && idle >= INACTIVITY_TIMEOUT

        Rails.logger.warn("[Gemini::LiveClient] Inactivity detected (#{idle.round(1)}s, silence pumping) — forcing reconnect")
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

        stop_silence_pump unless @model_emitting_audio
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

      # Stream partial to client with proper spacing
      return unless @on_input_transcription_partial

      partial_text = text.to_s
      if partial_text.present? && @last_input_partial.present?
        # Add space if current doesn't start with space and previous didn't end with space
        unless partial_text.start_with?(' ') || @last_input_partial.end_with?(' ')
          partial_text = ' ' + partial_text
        end
      end

      @on_input_transcription_partial.call(partial_text) if partial_text.present?
      @last_input_partial = partial_text
    end

    def handle_output_transcription(data)
      output_tx = data.dig('serverContent', 'outputTranscription')
      return unless output_tx

      text = output_tx.dig('parts', 0, 'text') || output_tx['text']
      @output_text_buffer << text.to_s

      # Stream partial to client with proper spacing
      return unless @on_output_transcription_partial

      partial_text = text.to_s
      if partial_text.present? && @last_output_partial.present?
        # Add space if current doesn't start with space and previous didn't end with space
        unless partial_text.start_with?(' ') || @last_output_partial.end_with?(' ')
          partial_text = ' ' + partial_text
        end
      end

      @on_output_transcription_partial.call(partial_text) if partial_text.present?
      @last_output_partial = partial_text
    end

    # Must run before turnComplete handling — both can arrive in the same message and order matters.
    # Flushes transcription immediately but delays gate open by GATE_OPEN_DELAY so the speaker drains and avoids echo.
    def handle_generation_complete(data)
      return unless data.dig('serverContent', 'generationComplete')

      emitted_audio = @model_emitting_audio
      @model_emitting_audio = false

      flush_input_buffer
      flush_output_buffer
      @last_input_partial = ''   # Reset partial tracking on generation complete
      @last_output_partial = ''  # Reset partial tracking on generation complete

      if emitted_audio
        @gate_timer&.cancel
        @gate_timer = EM::Timer.new(GATE_OPEN_DELAY) do
          unless @superseded
            Rails.logger.info('[Gemini::LiveClient] Gate open — firing on_model_turn_complete')
            @on_model_turn_complete&.call
          end
        end
      else
        Rails.logger.debug('[Gemini::LiveClient] Empty generationComplete (0 audio)')
        @on_model_turn_complete&.call
      end
    end

    # Open gate immediately on candidate barge-in — they're actively speaking so echo risk is moot.
    def handle_interrupted(data)
      return unless data.dig('serverContent', 'interrupted') && @model_emitting_audio

      @model_emitting_audio = false
      @model_interrupted = true
      @gate_timer&.cancel
      Rails.logger.info('[Gemini::LiveClient] Model interrupted — resetting audio gate immediately')
      flush_output_buffer
      @last_output_partial = '' # Reset partial tracking on interruption
      @on_model_turn_complete&.call
    end

    def handle_turn_complete(data)
      return unless data.dig('serverContent', 'turnComplete')

      if @model_emitting_audio
        # turnComplete without generationComplete — model interrupted or generation ended abruptly.
        @model_emitting_audio = false
        Rails.logger.info('[Gemini::LiveClient] Model interrupted — turnComplete without generationComplete')
        flush_output_buffer
        @on_model_turn_complete&.call
      elsif @model_interrupted
        # Stale post-interruption turnComplete — already handled via `interrupted`.
        @model_interrupted = false
      else
        # User's turn complete (or harmless stale model turnComplete after generationComplete).
        Rails.logger.info("[Gemini::LiveClient] User turnComplete — input_buffer=#{@input_text_buffer.length}chars silence_pumping=#{@silence_pumping}")
        stop_silence_pump
        flush_input_buffer
        @last_input_partial = ''
      end
    end

    def handle_resumption_update(data)
      resumption = data['sessionResumption'] || data['sessionResumptionUpdate']
      return unless resumption

      Rails.logger.debug("[Gemini::LiveClient] Resumption data: #{resumption.to_json}")
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

      # @on_input_transcription&.call(@input_text_buffer.strip)
      @on_input_transcription&.call(@input_text_buffer)
      @input_text_buffer = +''
      @last_input_partial = ''
    end

    def flush_output_buffer
      return unless @output_text_buffer.present?

      # @on_output_transcription&.call(@output_text_buffer.strip)
      @on_output_transcription&.call(@output_text_buffer)
      @output_text_buffer = +''
      @last_output_partial = ''
    end
  end
end
