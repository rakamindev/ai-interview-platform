# frozen_string_literal: true

require 'websocket-client-simple'
require 'json'
require 'base64'
require 'concurrent-ruby'

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
      on_model_turn_complete: nil,
      on_go_away: nil,
      on_close: nil,
      on_error: nil,
      on_ready: nil,
      on_setup_error: nil,
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
      @last_activity_at = nil
      @inactivity_timer = nil
      @last_audio_forwarded_at = nil
      @silence_pump_timer = nil

      @on_audio = on_audio
      @on_input_transcription = on_input_transcription
      @on_output_transcription = on_output_transcription
      @on_model_turn_complete = on_model_turn_complete
      @on_go_away = on_go_away
      @on_close = on_close
      @on_error = on_error
      @on_ready = on_ready
      @on_setup_error = on_setup_error
      @on_resumption_token_update = on_resumption_token_update
      @superseded = false
    end

    # Opens the WebSocket and sends setup; resumes a prior session if a handle is provided.
    def connect(resumption_handle: nil)
      @setup_complete = false
      
      client_self = self
      
      @ws = WebSocket::Client::Simple.connect(
        GEMINI_WS_URL,
        headers: { 'x-goog-api-key' => @api_key }
      )

      @ws.on(:open) do
        client_self.send(:handle_ws_open, resumption_handle)
      end

      @ws.on(:message) do |msg|
        client_self.send(:handle_message, msg.data)
      end

      @ws.on(:close) do |e|
        client_self.send(:handle_ws_close, e)
      end

      @ws.on(:error) do |e|
        client_self.send(:handle_ws_error, e)
      end

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

    # Injects hidden context via realtimeInput.text
    def inject_context(text, turn_complete: true)
      return false unless @connected && @ws
      @ws.send({ realtimeInput: { text: text } }.to_json)
      true
    end

    # Prompts Gemini to speak first
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
      @inactivity_timer&.shutdown if @inactivity_timer.respond_to?(:shutdown)
      @gate_timer&.cancel if @gate_timer.respond_to?(:cancel)
      stop_silence_pump
      @ws&.close
      @connected = false
    end

    # Silences callbacks before this client is replaced
    def supersede!
      @superseded = true
      @inactivity_timer&.shutdown if @inactivity_timer.respond_to?(:shutdown)
      @gate_timer&.cancel if @gate_timer.respond_to?(:cancel)
      stop_silence_pump
    end

    private

    def handle_ws_open(resumption_handle)
      send_setup(resumption_handle: resumption_handle)
      Rails.logger.info('[Gemini::LiveClient] WebSocket opened — awaiting setupComplete')
    end

    def handle_ws_close(event)
      @connected = false
      code = event.respond_to?(:code) ? event.code : 'unknown'
      reason = event.respond_to?(:reason) ? event.reason : 'unknown'
      Rails.logger.info("[Gemini::LiveClient] Connection closed: code=#{code} reason=#{reason} superseded=#{@superseded}")
      @on_close&.call(code: code, reason: reason) unless @superseded
    end

    def handle_ws_error(event)
      msg = event.respond_to?(:message) ? event.message : event.to_s
      Rails.logger.error("[Gemini::LiveClient] WebSocket error: #{msg}")
      @on_error&.call(msg) unless @superseded
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
      Rails.logger.debug("[Gemini::LiveClient] Audio forwarded: #{@audio_chunks_forwarded} chunks")
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

    def schedule_silence_pump
      stop_silence_pump if @silence_pumping

      @last_real_audio_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)

      return if @silence_pump_timer

      @silence_pump_timer = Concurrent::ScheduledTask.execute(SILENCE_PUMP_DELAY) do
        @silence_pump_timer = nil
        check_silence_pump_ready
      end
    end

    def check_silence_pump_ready
      return if @silence_pumping || !@connected || !@ws || @superseded || !@last_real_audio_at || @model_emitting_audio

      elapsed = Process.clock_gettime(Process::CLOCK_MONOTONIC) - @last_real_audio_at
      remaining = SILENCE_PUMP_DELAY - elapsed

      if remaining <= 0.02
        start_silence_pump
      else
        @silence_pump_timer = Concurrent::ScheduledTask.execute(remaining) do
          @silence_pump_timer = nil
          check_silence_pump_ready
        end
      end
    end

    def start_silence_pump
      return if @silence_pumping || !@connected || !@ws || @model_emitting_audio

      @silence_pumping = true
      Rails.logger.info('[Gemini::LiveClient] Silence pump started')

      silence_msg = {
        realtimeInput: {
          audio: {
            mimeType: 'audio/pcm;rate=16000',
            data: Base64.strict_encode64(SILENCE_FRAME)
          }
        }
      }.to_json.freeze

      @silence_pump_periodic = Concurrent::TimerTask.new(execution_interval: SILENCE_PUMP_INTERVAL) do
        if !@connected || !@ws || @superseded
          stop_silence_pump
        else
          @ws.send(silence_msg)
        end
      end
      @silence_pump_periodic.execute
    end

    def stop_silence_pump
      @silence_pump_timer&.cancel if @silence_pump_timer.respond_to?(:cancel)
      @silence_pump_timer = nil
      @last_real_audio_at = nil
      @silence_pump_periodic&.shutdown if @silence_pump_periodic.respond_to?(:shutdown)
      @silence_pump_periodic = nil
      @silence_pumping = false
    end

    def ensure_inactivity_watchdog
      return if @inactivity_timer || @superseded

      record_activity! unless @last_activity_at
      @inactivity_timer = Concurrent::TimerTask.new(execution_interval: 10) do
        next unless @connected && @last_activity_at

        now = Process.clock_gettime(Process::CLOCK_MONOTONIC)
        idle = now - @last_activity_at
        next unless @silence_pumping && idle >= INACTIVITY_TIMEOUT

        Rails.logger.warn("[Gemini::LiveClient] Inactivity detected — reconnecting")
        @inactivity_timer&.shutdown if @inactivity_timer.respond_to?(:shutdown)
        @inactivity_timer = nil
        @inactivity_close = true
        @ws&.close
      end
      @inactivity_timer.execute
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
              voiceConfig: { prebuiltVoiceConfig: { voiceName: @voice } }
            }
          },
          systemInstruction: { parts: [{ text: @system_prompt }] },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          contextWindowCompression: { slidingWindow: {} }
        }
      }

      setup[:setup][:sessionResumption] = resumption_handle.present? ? { handle: resumption_handle } : {}
      @ws.send(setup.to_json)
    end

    def handle_message(raw_data)
      return if @superseded

      data = JSON.parse(raw_data)
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
      preview = raw_data.to_s[0, 500]
      Rails.logger.error("[Gemini::LiveClient] Failed to parse message: #{e.message} raw=#{preview.inspect}")
      # Gemini rejects a bad setup (unknown model, unsupported config) with a plain-text
      # frame instead of JSON. Without surfacing it, setupComplete never arrives and the
      # browser waits on "Connecting..." forever.
      @on_setup_error&.call(preview) unless @setup_complete
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
    end

    def handle_output_transcription(data)
      output_tx = data.dig('serverContent', 'outputTranscription')
      return unless output_tx
      text = output_tx.dig('parts', 0, 'text') || output_tx['text']
      @output_text_buffer << text.to_s
    end

    def handle_generation_complete(data)
      return unless data.dig('serverContent', 'generationComplete')

      emitted_audio = @model_emitting_audio
      @model_emitting_audio = false
      flush_input_buffer
      flush_output_buffer

      if emitted_audio
        @gate_timer&.cancel if @gate_timer.respond_to?(:cancel)
        @gate_timer = Concurrent::ScheduledTask.execute(GATE_OPEN_DELAY) do
          unless @superseded
            Rails.logger.info('[Gemini::LiveClient] Gate open — firing on_model_turn_complete')
            @on_model_turn_complete&.call
          end
        end
      else
        @on_model_turn_complete&.call
      end
    end

    def handle_interrupted(data)
      return unless data.dig('serverContent', 'interrupted') && @model_emitting_audio

      @model_emitting_audio = false
      @model_interrupted = true
      @gate_timer&.cancel if @gate_timer.respond_to?(:cancel)
      Rails.logger.info('[Gemini::LiveClient] Model interrupted — resetting audio gate immediately')
      flush_output_buffer
      @on_model_turn_complete&.call
    end

    def handle_turn_complete(data)
      return unless data.dig('serverContent', 'turnComplete')

      if @model_emitting_audio
        @model_emitting_audio = false
        flush_output_buffer
        @on_model_turn_complete&.call
      elsif @model_interrupted
        @model_interrupted = false
      else
        stop_silence_pump
        flush_input_buffer
      end
    end

    def handle_resumption_update(data)
      resumption = data['sessionResumption'] || data['sessionResumptionUpdate']
      return unless resumption

      handle = resumption['newHandle'] || resumption['handle'] || resumption['token']
      return unless handle.present?

      @resumption_token = handle
      @on_resumption_token_update&.call(handle)
    end

    def handle_setup_complete(data)
      return unless data['setupComplete']
      @setup_complete = true
      @connected_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      activate_connection!
    end

    def handle_go_away_event(data)
      return unless data['goAway']
      time_left = data.dig('goAway', 'timeLeft')
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
