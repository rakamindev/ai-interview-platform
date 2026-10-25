# frozen_string_literal: true

module Gemini
  # Interactive AI Interviewer fallback engine for bidirectional WebSocket sessions.
  # Activates automatically in development when GEMINI_API_KEY is unset/mocked or when
  # Google's BidiGenerateContent WebSocket rejects the configured model/key (e.g. code 1008).
  #
  # Capabilities:
  # - Builds a skill-aware interview agenda from the Assessment's configured skills & anchors.
  # - Buffers live 16kHz 16-bit mono PCM audio frames from `useAudioCapture` and uses an
  #   asynchronous end-of-speech timer (`VAD_SILENCE_SEC`) that fires when the candidate
  #   stops speaking (even when `audio-worklet-processor.js` stops sending silent frames).
  # - Transcribes candidate WAV audio and generates contextual follow-ups via `Gemini::HttpClient`
  #   (`v1beta` multimodal REST API), with deterministic skill-aware fallback when offline/denied.
  # - Synchronizes turn completion with browser TTS (`notify_ai_speech_finished`) so the
  #   microphone unmutes cleanly after the AI finishes speaking.
  class MockLiveClient
    attr_reader :connected, :inactivity_close

    RMS_SPEECH_THRESHOLD = 160       # 16-bit signed PCM RMS threshold for genuine human voice
    MIN_SPEECH_FRAMES    = 12        # ~100ms+ of active voiced frames required to count as speech
    VAD_SILENCE_SEC      = 1.7       # seconds after last speech frame before auto-finalizing turn
    MAX_AUDIO_BYTES      = 1_920_000 # max ~60s of 16kHz 16-bit mono PCM per turn

    def initialize(
      system_prompt:,
      session: nil,
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
      @session = session
      @on_audio = on_audio
      @on_input_transcription = on_input_transcription
      @on_output_transcription = on_output_transcription
      @on_model_turn_complete = on_model_turn_complete
      @on_ready = on_ready
      @connected = false
      @inactivity_close = false

      @turn_index = 0
      @candidate_turns = 0
      @history = []
      @audio_buffer = (+'').b
      @speech_frames = 0
      @last_speech_at = nil
      @silence_timer = nil
      @tts_safety_timer = nil
      @processing_turn = false
      @ai_speaking = false
      @wrap_up_requested = false
      @mutex = Mutex.new
      @skills = extract_skills
    end

    def connect(resumption_handle: nil)
      @connected = true
      Rails.logger.info("[Gemini::MockLiveClient] Connected interactive AI interviewer (skills=#{@skills.map { |s| s[:label] }.join(', ')})")
      schedule_action(0.25) { @on_ready&.call }
    end

    def trigger_opening
      return unless @connected

      role_name = @session&.assessment&.name.presence || 'this role'
      first_skill = @skills.first
      opening = if first_skill
                  "Hi, thanks for joining your #{role_name} interview today! Let's jump right in — could you walk me through a technically challenging project you built recently involving #{first_skill[:label]}, and the key architectural decisions you owned?"
                else
                  "Hi, thanks for joining your #{role_name} interview today! Let's jump right in — tell me about the most technically challenging system you've designed or built recently."
                end

      emit_ai_response(opening)
    end

    def accepting_audio?
      @connected && !@processing_turn && !@ai_speaking
    end

    def silence_pumping?
      false
    end

    # Receives raw 16kHz 16-bit mono PCM audio bytes from the browser microphone.
    # Because `audio-worklet-processor.js` stops sending frames after ~50ms of silence,
    # we reset an asynchronous timer (`@silence_timer`) on every incoming frame once
    # speech energy is detected. When frames stop arriving for `VAD_SILENCE_SEC`, the
    # timer fires and processes the candidate's spoken turn.
    def send_audio(pcm_bytes)
      return unless accepting_audio?
      return if pcm_bytes.nil? || pcm_bytes.bytesize < 4

      rms = compute_pcm_rms(pcm_bytes)

      @mutex.synchronize do
        if @audio_buffer.bytesize < MAX_AUDIO_BYTES
          @audio_buffer << pcm_bytes.b
        end

        if rms >= RMS_SPEECH_THRESHOLD
          @speech_frames += 1
          @last_speech_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)
        end

        if @speech_frames >= MIN_SPEECH_FRAMES
          reset_silence_timer
        end
      end
    end

    # Called when the frontend detects silence after speech or the user clicks "Done Speaking".
    def finish_candidate_audio_turn
      return unless @connected && !@processing_turn

      cancel_timer(@silence_timer)
      @silence_timer = nil

      has_audio = @mutex.synchronize { @speech_frames >= 4 && @audio_buffer.bytesize >= 1600 }
      if has_audio
        finalize_audio_turn!
      end
    end

    # Called when browser `window.speechSynthesis` finishes speaking the AI question.
    def notify_ai_speech_finished
      return unless @connected

      cancel_timer(@tts_safety_timer)
      @tts_safety_timer = nil

      complete_ai_speaking_turn
    end

    # Receives explicit candidate text input (or speech transcript) from the browser.
    def receive_candidate_speech(text)
      cleaned = text.to_s.strip
      return if cleaned.empty? || !@connected || @processing_turn

      @mutex.synchronize do
        @processing_turn = true
        @speech_frames = 0
        @last_speech_at = nil
        @audio_buffer.clear
      end
      cancel_timer(@silence_timer)
      @silence_timer = nil

      process_candidate_turn(cleaned)
    end

    def inject_context(text, turn_complete: true)
      return false unless @connected

      if text.to_s.include?('"wrap_up": true')
        @wrap_up_requested = true
        Rails.logger.info('[Gemini::MockLiveClient] Wrap-up signal received — next AI response will close the interview')
      end
      true
    end

    def close
      @connected = false
      cancel_timer(@silence_timer)
      cancel_timer(@tts_safety_timer)
    end

    def supersede!
      close
    end

    private

    def reset_silence_timer
      cancel_timer(@silence_timer)
      @silence_timer = schedule_timer(VAD_SILENCE_SEC) do
        @silence_timer = nil
        finalize_audio_turn!
      end
    end

    def finalize_audio_turn!
      return if !@connected || @processing_turn || @ai_speaking

      pcm_snapshot = nil
      frames_count = 0

      @mutex.synchronize do
        return if @processing_turn || @speech_frames < 4 || @audio_buffer.bytesize < 1600

        @processing_turn = true
        pcm_snapshot = @audio_buffer.dup
        frames_count = @speech_frames
        @audio_buffer.clear
        @speech_frames = 0
        @last_speech_at = nil
      end

      Rails.logger.info("[Gemini::MockLiveClient] Finalizing candidate voice turn (bytes=#{pcm_snapshot.bytesize} frames=#{frames_count})")

      Thread.new do
        handle_recorded_pcm_turn(pcm_snapshot)
      rescue StandardError => e
        Rails.logger.error("[Gemini::MockLiveClient] Voice turn error: #{e.class}: #{e.message}")
        fallback_text = build_candidate_vad_summary(current_skill_for_turn)
        process_candidate_turn(fallback_text)
      end
    end

    def handle_recorded_pcm_turn(pcm_bytes)
      wav_bytes = build_wav_bytes(pcm_bytes, sample_rate: 16_000, channels: 1, bits_per_sample: 16)
      multimodal_result = transcribe_and_reply_with_gemini(wav_bytes)

      if multimodal_result
        candidate_text = multimodal_result[:candidate_transcript].presence || build_candidate_vad_summary(current_skill_for_turn)
        ai_reply       = multimodal_result[:ai_reply].presence

        @candidate_turns += 1
        @history << { role: 'candidate', text: candidate_text }
        @on_input_transcription&.call(candidate_text)
        advance_coverage_for_turn(candidate_text)

        reply = if @wrap_up_requested
                  build_closing_statement(candidate_text)
                elsif ai_reply.present?
                  ai_reply
                else
                  build_fallback_question(candidate_text)
                end
        emit_ai_response(reply)
      else
        fallback_text = build_candidate_vad_summary(current_skill_for_turn)
        process_candidate_turn(fallback_text)
      end
    end

    def process_candidate_turn(candidate_text)
      @candidate_turns += 1
      @history << { role: 'candidate', text: candidate_text }
      @on_input_transcription&.call(candidate_text)
      advance_coverage_for_turn(candidate_text)

      Thread.new do
        reply = if @wrap_up_requested
                  build_closing_statement(candidate_text)
                else
                  generate_contextual_reply(candidate_text)
                end
        emit_ai_response(reply)
      rescue StandardError => e
        Rails.logger.error("[Gemini::MockLiveClient] Reply generation error: #{e.message}")
        emit_ai_response(build_fallback_question(candidate_text))
      end
    end

    def emit_ai_response(text)
      return unless @connected

      @history << { role: 'ai', text: text }
      @turn_index += 1
      @ai_speaking = true
      @processing_turn = true

      schedule_action(0.25) do
        next unless @connected

        @on_output_transcription&.call(text)

        # Wait for browser TTS `ai_speech_finished` notification, with a generous word-based safety timeout
        # so the mic never unmutes while the AI voice is still speaking out loud.
        word_count = text.split.size
        safety_delay = (word_count * 0.42).clamp(4.0, 14.0)
        cancel_timer(@tts_safety_timer)
        @tts_safety_timer = schedule_timer(safety_delay) do
          @tts_safety_timer = nil
          complete_ai_speaking_turn
        end
      end
    end

    def complete_ai_speaking_turn
      return unless @connected && (@ai_speaking || @processing_turn)

      @mutex.synchronize do
        @ai_speaking = false
        @processing_turn = false
        @audio_buffer.clear
        @speech_frames = 0
        @last_speech_at = nil
      end

      @on_model_turn_complete&.call if @connected
    end

    def transcribe_and_reply_with_gemini(wav_bytes)
      api_key = ENV['GEMINI_API_KEY'].to_s
      return nil unless valid_gemini_key?(api_key)

      client = Gemini::HttpClient.new(
        api_key: api_key,
        model: ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-2.5-flash'),
        timeout: 10
      )
      convo = @history.last(8).map { |h| "#{h[:role].upcase}: #{h[:text]}" }.join("\n")
      closing_instruction = if @wrap_up_requested
                              'All skills are covered. Acknowledge their answer in 1 sentence and close the interview warmly in 1 sentence (include "thank you for your time"). Do NOT ask any more questions.'
                            else
                              'Respond as the AI technical interviewer in 2-3 natural spoken sentences. Acknowledge a specific technical point from their spoken answer and ask ONE probing follow-up question.'
                            end

      prompt = <<~PROMPT
        #{@system_prompt}

        CONVERSATION SO FAR:
        #{convo}

        Listen to the candidate's spoken audio response attached.
        Return a valid JSON object with EXACTLY two keys:
        {
          "candidate_transcript": "<exact verbatim transcription of what the candidate said in the audio>",
          "ai_reply": "<#{closing_instruction} Plain spoken text only, no markdown.>"
        }
      PROMPT

      response = client.generate_content_with_audio(prompt, wav_bytes: wav_bytes, temperature: 0.3)
      if response.is_a?(Hash) && response['candidate_transcript'].to_s.strip.present?
        return {
          candidate_transcript: response['candidate_transcript'].to_s.strip,
          ai_reply: response['ai_reply'].to_s.gsub(/[*_`#]/, '').strip
        }
      end
      nil
    rescue StandardError => e
      Rails.logger.warn("[Gemini::MockLiveClient] Multimodal audio transcription unavailable (#{e.message}) — using contextual turn fallback")
      nil
    end

    def generate_contextual_reply(candidate_text)
      api_key = ENV['GEMINI_API_KEY'].to_s
      if valid_gemini_key?(api_key)
        client = Gemini::HttpClient.new(
          api_key: api_key,
          model: ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-2.5-flash'),
          timeout: 8
        )
        convo = @history.last(8).map { |h| "#{h[:role].upcase}: #{h[:text]}" }.join("\n")
        prompt = <<~PROMPT
          #{@system_prompt}

          CONVERSATION SO FAR:
          #{convo}

          Respond as the AI interviewer to the candidate's last answer in 2-3 natural spoken sentences.
          Acknowledge a specific detail they mentioned, and ask ONE probing follow-up question.
          Output plain spoken text only (no markdown, no JSON, no labels).
        PROMPT
        response = client.generate_content(prompt, temperature: 0.5)
        cleaned = response.is_a?(String) ? response.gsub(/[*_`#]/, '').strip : ''
        return cleaned if cleaned.present? && cleaned.length > 15
      end

      build_fallback_question(candidate_text)
    rescue StandardError
      build_fallback_question(candidate_text)
    end

    def build_fallback_question(candidate_text)
      return build_closing_statement(candidate_text) if @wrap_up_requested

      skill_idx = [(@candidate_turns - 1) / 2, 0].max
      probe_step = (@candidate_turns - 1) % 3
      current_skill = @skills[skill_idx] || @skills.last
      next_skill = @skills[skill_idx + 1]

      snippet = extract_candidate_topic(candidate_text)

      if current_skill && probe_step.zero?
        scope_hint = current_skill[:scope].presence || 'production scalability and edge-case handling'
        "That makes sense regarding #{snippet}. Digging deeper into #{current_skill[:label]} — when you had to deal with #{scope_hint}, what specific trade-offs or failure modes did you run into, and how did you verify your solution under load?"
      elsif current_skill && probe_step == 1 && next_skill.nil?
        "I appreciate that detail on #{snippet}. Still looking at #{current_skill[:label]} — if traffic or state complexity grew by 10x tomorrow, which part of your implementation would become the bottleneck first, and how would you refactor it?"
      elsif next_skill
        "I appreciate that breakdown on #{snippet}. Shifting gears to #{next_skill[:label]} — could you walk me through a concrete situation where you designed or debugged a complex system in that area?"
      elsif @candidate_turns < required_total_turns
        "Thanks for sharing those details on #{snippet}. Thinking about observability and production resilience, how did you measure the impact of those changes and prevent regressions across deployments?"
      else
        build_closing_statement(candidate_text)
      end
    end

    def build_closing_statement(candidate_text)
      snippet = extract_candidate_topic(candidate_text)
      "Thank you for walking me through #{snippet} and explaining your architectural trade-offs so clearly. That concludes our interview today — thank you for your time, and our hiring team will review your results and follow up with you soon."
    end

    def extract_candidate_topic(text)
      words = text.to_s.gsub(/[^a-zA-Z0-9\s\-]/, '').split
      meaningful = words.reject { |w| w.length < 4 || %w[that this with from have been were they their about would could recent work designed architecture around].include?(w.downcase) }
      return 'your architectural approach' if meaningful.empty?

      meaningful.last(3).join(' ')
    end

    def build_candidate_vad_summary(skill)
      label = skill ? skill[:label] : 'software architecture'
      scope = skill && skill[:scope].present? ? skill[:scope] : 'modular component design, state synchronization, and automated testing'
      case @candidate_turns
      when 0
        "In my recent work on #{label}, I led the architecture around #{scope}, separating domain state from UI rendering and adding automated integration tests."
      when 1
        "To handle trade-offs in #{label}, we profiled render and query bottlenecks, introduced memoized selectors and request deduplication, and verified p95 latency under load."
      else
        "For 10x scale and reliability in #{label}, I implemented strict error boundaries, idempotent retry policies, and telemetry alerts so regressions are caught before full rollout."
      end
    end

    def current_skill_for_turn
      idx = [(@candidate_turns - 1) / 2, 0].max
      @skills[idx] || @skills.first
    end

    def required_total_turns
      [@skills.size * 2, 3].max
    end

    def extract_skills
      if @session&.assessment
        db_skills = @session.assessment.assessment_skills.order(:display_order).map do |s|
          { id: s.skill_id, label: s.skill_label, scope: s.scope_include.to_s.split(',').first(2).join(' and ') }
        end
        return db_skills if db_skills.any?
      end

      parsed = @system_prompt.to_s.scan(/SKILL:\s*(.+?)\nSCOPE:\s*(.+?)\n/).map do |label, scope|
        { id: nil, label: label.strip, scope: scope.strip.split(',').first(2).join(' and ') }
      end
      return parsed if parsed.any?

      [
        { id: 'react', label: 'Frontend Architecture & State Management', scope: 'component design and state synchronization' },
        { id: 'system-design', label: 'System Design & API Resilience', scope: 'caching, error boundaries, and performance optimization' }
      ]
    end

    def advance_coverage_for_turn(_candidate_text)
      return unless @session

      ActiveRecord::Base.connection_pool.with_connection do
        maps = @session.coverage_maps.where(is_discovered: false).order(:id).to_a
        return if maps.empty?

        target = maps.find { |m| m.state != 'covered' } || maps.last
        new_count = target.probe_count.to_i + 1
        # Require 3 probes when there is only 1 skill in the assessment so single-skill interviews
        # conduct a full multi-turn technical deep dive before auto-wrapping up.
        probes_for_covered = maps.size == 1 ? 3 : 2
        new_state = if new_count >= probes_for_covered
                      'covered'
                    elsif new_count == 1
                      'partial'
                    else
                      'initiated'
                    end
        target.update_columns(probe_count: new_count, state: new_state, updated_at: Time.current)
      end
    rescue StandardError => e
      Rails.logger.warn("[Gemini::MockLiveClient] Coverage update skipped: #{e.message}")
    end

    def compute_pcm_rms(pcm_bytes)
      samples = pcm_bytes.unpack('s<*')
      return 0 if samples.empty?

      sum_sq = samples.sum { |s| s * s }
      Math.sqrt(sum_sq.to_f / samples.length)
    rescue StandardError
      0
    end

    def build_wav_bytes(pcm_bytes, sample_rate: 16_000, channels: 1, bits_per_sample: 16)
      byte_rate   = sample_rate * channels * (bits_per_sample / 8)
      block_align = channels * (bits_per_sample / 8)
      data_size   = pcm_bytes.bytesize
      riff_size   = 36 + data_size

      header = [
        'RIFF', riff_size, 'WAVE',
        'fmt ', 16, 1, channels, sample_rate, byte_rate, block_align, bits_per_sample,
        'data', data_size
      ].pack('A4VA4A4VvvVVvvA4V')

      header + pcm_bytes.b
    end

    def valid_gemini_key?(api_key)
      api_key.present? && !%w[your_gemini_api_key your_gemini_api_key_here mock].include?(api_key)
    end

    def schedule_timer(delay, &block)
      if defined?(EM) && EM.reactor_running?
        EM::Timer.new(delay, &block)
      else
        Thread.new do
          sleep delay
          block.call
        end
      end
    end

    def cancel_timer(timer)
      return unless timer

      if timer.respond_to?(:cancel)
        timer.cancel
      elsif timer.is_a?(Thread)
        timer.kill
      end
    rescue StandardError
      nil
    end

    def schedule_action(delay, &block)
      schedule_timer(delay, &block)
    end
  end
end
