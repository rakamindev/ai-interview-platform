# frozen_string_literal: true

require 'eventmachine'

module Gemini
  # Intelligent fallback client that simulates an AI Assessor session when
  # Gemini Live API is unavailable, unwhitelisted (code 1008), or in offline dev mode.
  # Incorporates Voice Activity Detection (VAD) via PCM RMS energy so that turns
  # are ONLY triggered when the candidate actually speaks into their microphone.
  class SimulatedLiveClient
    GATE_OPEN_DELAY = 0.5
    SILENCE_FRAME_SAMPLES = 640
    # 24kHz synthetic PCM sine wave beep for realistic audio playback
    SINE_FRAME = (Array.new(SILENCE_FRAME_SAMPLES) { |i| (Math.sin(i * 0.1) * 3000).to_i }.pack('s*')).freeze

    # Voice Activity Detection (VAD) configuration
    # Raised threshold to require genuine vocal sound and ignore ambient/mic noise
    VAD_RMS_THRESHOLD   = 3200  # Minimum vocal RMS energy (normal human voice is 3500-10000; mic noise is <2000)
    SPEECH_FRAMES_MIN   = 25    # Require ~1s of sustained vocal frames before marking speech started
    SILENCE_PAUSE_SEC   = 2.5   # Silence pause duration required AFTER speech to mark answer complete
    MAX_SPEECH_SEC      = 20.0  # Max speech window before auto-submitting

    attr_reader :connected, :connected_at, :inactivity_close, :resumption_token

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
      @voice = voice
      @connected = false
      @superseded = false
      @resumption_token = 'simulated-token-01'

      @on_audio = on_audio
      @on_input_transcription = on_input_transcription
      @on_output_transcription = on_output_transcription
      @on_model_turn_complete = on_model_turn_complete
      @on_go_away = on_go_away
      @on_close = on_close
      @on_error = on_error
      @on_ready = on_ready
      @on_resumption_token_update = on_resumption_token_update

      @question_index = 0
      @speech_frame_count = 0
      @candidate_has_spoken = false
      @silence_after_speech_timer = nil
      @max_speech_timer = nil

      @questions = [
        "Halo! Selamat datang di sesi wawancara AI Rakamin. Saya adalah AI Assessor yang akan mengevaluasi kompetensi Anda. Untuk memulai, bisakah Anda memperkenalkan diri dan menceritakan pengalaman teknis Anda dalam pengembangan aplikasi web?",
        "Bagus sekali. Bisakah Anda menjelaskan bagaimana Anda merancang arsitektur aplikasi frontend yang scalable, serta bagaimana Anda mengelola state management yang efisien?",
        "Menarik. Terkait kualitas kode dan reliabilitas, bagaimana pendekatan Anda dalam menerapkan Automated Testing, CI/CD pipeline, dan monitoring performa di lingkungan produksi?",
        "Bagaimana strategi Anda dalam menangani optimasi query database, latency API, dan keamanan sistem sesuai standar privasi data?",
        "Terima kasih atas jawaban komprehensif Anda. Anda telah menjelaskan seluruh aspek kompetensi teknis dengan sangat baik. Sesi evaluasi wawancara kita hari ini telah selesai."
      ]
    end

    def connect(resumption_handle: nil)
      @connected = true
      @connected_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      Rails.logger.info('[SimulatedLiveClient] Session ready — accepting audio with VAD voice detection')

      # Fire on_ready asynchronously via EM reactor next_tick
      EM.next_tick do
        return if @superseded
        @on_ready&.call
      end
    end

    def trigger_opening
      return unless @connected && !@superseded

      EM.add_timer(0.3) do
        return if @superseded
        speak_turn(@questions[@question_index] || @questions.first)
        @question_index += 1
      end
    end

    # Receives live PCM audio from browser microphone.
    # Uses RMS energy analysis to detect actual candidate voice.
    # If the candidate is silent or ambient room noise, NO turn is triggered.
    def send_audio(pcm_bytes)
      return unless @connected && !@superseded

      rms = calculate_rms(pcm_bytes)

      if rms >= VAD_RMS_THRESHOLD
        # Vocal energy detected!
        @speech_frame_count += 1
        @silence_after_speech_timer&.cancel
        @silence_after_speech_timer = nil

        if @speech_frame_count >= SPEECH_FRAMES_MIN && !@candidate_has_spoken
          @candidate_has_spoken = true
          Rails.logger.info("[SimulatedLiveClient] Candidate speech detected (RMS=#{rms.round}) — listening...")

          # Max speech safety timer
          @max_speech_timer&.cancel
          @max_speech_timer = EM::Timer.new(MAX_SPEECH_SEC) do
            @max_speech_timer = nil
            finish_candidate_turn! if @candidate_has_spoken && @connected && !@superseded
          end
        end
      else
        # Audio is silence or ambient noise below threshold
        @speech_frame_count = [@speech_frame_count - 1, 0].max unless @candidate_has_spoken

        if @candidate_has_spoken && @silence_after_speech_timer.nil?
          # Candidate was speaking and has now paused — wait for pause confirmation
          @silence_after_speech_timer = EM::Timer.new(SILENCE_PAUSE_SEC) do
            @silence_after_speech_timer = nil
            @max_speech_timer&.cancel
            @max_speech_timer = nil
            finish_candidate_turn! if @candidate_has_spoken && @connected && !@superseded
          end
        end
      end
    end

    def inject_context(text, turn_complete: true)
      Rails.logger.info("[SimulatedLiveClient] inject_context: #{text.to_s.truncate(80)}")
      if text.to_s.include?('SYS-TC-7x9k') || text.to_s.include?('wrap_up')
        EM.add_timer(0.5) do
          next if @superseded || !@connected
          speak_turn(@questions.last)
        end
      end
      true
    end

    def accepting_audio?
      @connected && !@superseded
    end

    def silence_pumping?
      false
    end

    def close
      @connected = false
      @silence_after_speech_timer&.cancel
      @max_speech_timer&.cancel
    end

    def supersede!
      @superseded = true
      @silence_after_speech_timer&.cancel
      @max_speech_timer&.cancel
      close
    end

    private

    def calculate_rms(pcm_bytes)
      return 0 if pcm_bytes.nil? || pcm_bytes.empty?
      samples = pcm_bytes.unpack('s*')
      return 0 if samples.empty?

      sum_sq = samples.sum { |s| s * s }
      Math.sqrt(sum_sq.to_f / samples.size)
    rescue StandardError
      0
    end

    def finish_candidate_turn!
      return if @superseded || !@connected

      @candidate_has_spoken = false
      @speech_frame_count = 0
      @silence_after_speech_timer&.cancel
      @silence_after_speech_timer = nil
      @max_speech_timer&.cancel
      @max_speech_timer = nil

      candidate_sample_texts = [
        "Saya memiliki pengalaman 4 tahun mengembangkan aplikasi web dengan React, TypeScript, dan Ruby on Rails. Di proyek terakhir, saya memimpin implementasi arsitektur micro-frontend dan automated testing.",
        "Untuk state management, saya mengombinasikan React Query untuk server state dan Zustand untuk client state, sehingga meminimalkan re-render yang tidak perlu.",
        "Di sisi CI/CD, kami menggunakan GitHub Actions dengan linting, unit test Jest, dan end-to-end Playwright sebelum deploy otomatis ke Kubernetes cluster.",
        "Untuk optimasi performa, kami melakukan database indexing, query caching Redis, serta profiling render latency agar aplikasi tetap responsif."
      ]

      sample = candidate_sample_texts[(@question_index - 1) % candidate_sample_texts.length]
      Rails.logger.info("[SimulatedLiveClient] Candidate speech finished — submitting turn: #{sample.truncate(50)}")
      @on_input_transcription&.call(sample)

      # AI responds after a brief 1.2s pause
      EM.add_timer(1.2) do
        next if @superseded || !@connected
        next_q = @questions[@question_index] || @questions.last
        speak_turn(next_q)
        @question_index += 1
      end
    end

    def speak_turn(text)
      return if @superseded

      # Send synthetic audio frames so VoiceBars dance and playback triggers
      4.times do
        @on_audio&.call(SINE_FRAME)
      end

      # Send text transcription
      @on_output_transcription&.call(text)

      # After turn completes, open the gate for candidate
      EM.add_timer(GATE_OPEN_DELAY) do
        return if @superseded
        @on_model_turn_complete&.call
      end
    end
  end
end
