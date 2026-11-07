# frozen_string_literal: true

require 'faye/websocket'

# Rack middleware that proxies a WebSocket at /ws/sessions/:id/audio between the browser (16kHz PCM)
# and Gemini Live (24kHz PCM). Audio is buffered in a ring buffer for reconnection replay.
class AudioWebSocketMiddleware
  AUDIO_PATH_PATTERN = %r{\A/ws/sessions/([^/]+)/audio\z}

  MAX_RECONNECT_ATTEMPTS = 3
  RECONNECT_BACKOFF = [1, 2, 4].freeze
  BROWSER_GRACE_PERIOD = ENV.fetch('BROWSER_GRACE_PERIOD', 120).to_i # seconds to keep Gemini alive after browser disconnects
  OWNERSHIP_CHECK_INTERVAL = 2 # seconds; how long a replaced connection can keep its Gemini client open
  TOKEN_PERSIST_INTERVAL = 5 # seconds; a browser reconnect resumes from the persisted token
  MAX_TURN_NUMBER_RETRIES = 3
  START_TIMEOUT = ENV.fetch('INTERVIEW_START_TIMEOUT', 30).to_i # seconds to wait for Gemini before telling the candidate
  PROACTIVE_RECONNECT_AFTER = ENV.fetch('PROACTIVE_RECONNECT_AFTER', 510).to_i
  PROACTIVE_RECONNECT_JITTER = 30  # randomise to avoid thundering herd

  SYSTEM_SIGNAL_TOKEN = 'SYS-TC-7x9k'

  WRAP_UP_SIGNAL = "[TIME CONTROL:#{SYSTEM_SIGNAL_TOKEN}] { \"wrap_up\": true, \"all_skills_covered\": true }" \
                   ' — Close the interview NOW. Do NOT ask any more questions.' \
                   ' Acknowledge their last answer in one sentence, then say goodbye in one sentence.' \
                   ' Two sentences total, then stop.'

  def initialize(app)
    @app = app
  end

  def call(env)
    path = env['PATH_INFO']
    match = AUDIO_PATH_PATTERN.match(path)

    return @app.call(env) unless match && Faye::WebSocket.websocket?(env)

    handle_audio_websocket(env, match[1])
  end

  private

  def handle_audio_websocket(env, session_id)
    browser_ws = Faye::WebSocket.new(env, nil, ping: 30)
    state = ConnectionState.new

    browser_ws.on(:open)    { |_event| handle_browser_open(env, session_id, browser_ws, state) }
    browser_ws.on(:message) { |event| handle_browser_frame(event, browser_ws, state, session_id) }
    browser_ws.on(:close)   { |event| handle_browser_close(event, browser_ws, state, session_id) }

    browser_ws.rack_response
  end

  def handle_browser_open(env, session_id, browser_ws, state)
    session, error = authenticate_and_load(env, session_id)

    if session&.ended?
      report_session_already_ended(browser_ws, session)
      return
    end

    if error
      browser_ws.send({ type: 'error', code: 'auth_failed', message: error, recoverable: false }.to_json)
      browser_ws.close
      return
    end

    state.session = session

    unless session.claim_audio_connection!(state.connection_id)
      report_session_already_ended(browser_ws, session)
      return
    end

    start_ownership_watch(browser_ws, state)
    start_interview_timeout(browser_ws, state)
    connect_to_gemini(browser_ws, state)
  rescue StandardError => e
    Rails.logger.error("[AudioWS] Exception in on:open: #{e.class}: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
    browser_ws.close
  end

  def report_session_already_ended(browser_ws, session)
    send_json(browser_ws, type: 'session_ended', reason: session.end_reason)
    browser_ws.close
  end

  def handle_browser_frame(event, browser_ws, state, session_id)
    if event.data.is_a?(String) && !event.data.start_with?('{')
      forward_audio_frame(event.data, state, session_id)
    else
      handle_browser_message(event.data, browser_ws, state)
    end
  end

  # Forward audio frame to Gemini when ready; suppress while model is speaking to prevent echo loop.
  def forward_audio_frame(data, state, session_id)
    if state.model_speaking
      # Server-side audio gate: suppress mic while model is speaking to prevent speaker echo loop.
      unless state.logged_gate_suppressed
        Rails.logger.warn("[AudioWS] Audio suppressed by model_speaking gate (session=#{session_id})")
        state.logged_gate_suppressed = true
      end
    elsif state.gemini_client&.accepting_audio?
      state.logged_gate_suppressed = false
      state.gemini_client.send_audio(data)
    else
      # Log once per gap to avoid spam (~33 chunks/s during reconnection).
      unless state.logged_not_ready
        Rails.logger.warn("[AudioWS] Audio received but Gemini not ready — buffering (accepting=#{state.gemini_client&.accepting_audio?} connected=#{state.gemini_client&.connected})")
        state.logged_not_ready = true
      end
    end
  end

  def handle_browser_close(event, browser_ws, state, session_id)
    Rails.logger.info("[AudioWS] Browser disconnected: session=#{session_id} code=#{event.code}")
    state.browser_disconnected_at = Time.current
    return if state.retired || !state.session

    # Nothing has started, so there is nothing to protect: the invitation stays usable and Gemini can go.
    if state.session.pending?
      shutdown_connection(state)
      return
    end

    state.proactive_reconnect_timer&.cancel

    # The replacement connection resumes from this token, so it must not wait for the debounce.
    persist_resumption_token(state)

    # Keep Gemini alive during grace period in case candidate reconnects via page refresh.
    schedule_graceful_end(browser_ws, state)
  end

  def connect_to_gemini(browser_ws, state)
    session = state.session

    ensure_system_prompt(session)

    unless session.assessment.system_prompt.present?
      send_json(browser_ws, type: 'error', code: 'no_system_prompt',
                            message: 'Assessment configuration is incomplete.', recoverable: false)
      browser_ws.close
      return
    end

    state.turn_counter = session.transcript_turns.maximum(:turn_number).to_i

    build_gemini_client(browser_ws, state)
    state.gemini_client.connect(resumption_handle: session.gemini_resumption_token.presence)
  end

  def ensure_system_prompt(session)
    return if session.assessment.system_prompt.present?

    Rails.logger.warn("[AudioWS] system_prompt missing for assessment #{session.assessment.id} — regenerating")
    Assessments::SystemPromptCompiler.new(session.assessment).call.tap do |prompt|
      session.assessment.update_column(:system_prompt, prompt)
    end
  end

  def build_gemini_client(browser_ws, state)
    session = state.session

    state.gemini_client = Gemini::LiveClient.new(
      system_prompt: session.assessment.system_prompt,
      on_audio: build_on_audio(browser_ws, state),
      on_input_transcription: build_on_input_transcription(browser_ws, state, session),
      on_output_transcription: build_on_output_transcription(browser_ws, state, session),
      on_model_turn_complete: build_on_model_turn_complete(browser_ws, state, session),
      on_go_away: ->(time_left:, resumption_token:) { handle_go_away(browser_ws, state, resumption_token) },
      on_close: ->(code:, reason:) { handle_gemini_close(browser_ws, state, code: code, reason: reason) },
      on_error: ->(message) { Rails.logger.error("[AudioWS] Gemini error: session=#{session.id} #{message}") },
      on_resumption_token_update: build_on_resumption_token_update(state, session),
      on_ready: build_on_ready(browser_ws, state, session)
    )
  end

  def build_on_audio(browser_ws, state)
    lambda { |pcm_bytes|
      # First audio frame of a turn → frontend mutes mic to prevent speaker feedback.
      unless state.model_speaking
        state.model_speaking = true
        state.ai_audio_chunks = 0
        Rails.logger.info('[AudioWS] AI audio started — sending speaker_changed:ai')
        send_json(browser_ws, type: 'speaker_changed', speaker: 'ai')
      end

      state.ai_audio_chunks = (state.ai_audio_chunks || 0) + 1

      begin
        browser_ws.send(pcm_bytes.bytes)
      rescue StandardError => e
        Rails.logger.error("[AudioWS] Failed to send audio to browser: #{e.class}: #{e.message}")
      end
    }
  end

  # Fires once per complete candidate turn (full sentence accumulated).
  def build_on_input_transcription(browser_ws, state, session)
    lambda { |text|
      next unless text.present?

      turn_number = state.increment_turn!

      maybe_inject_coverage(state, session)
      maybe_piggyback_wrap_up(state, session)

      # Push DB writes off the EM thread so audio forwarding doesn't stall.
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          saved_turn_number = save_transcript_turn(session, turn_number, 'candidate', text) || turn_number
          CoverageAnalyzerWorker.perform_async(session.id, saved_turn_number)
          refresh_coverage_cache(session, state)
        end
      rescue StandardError => e
        Rails.logger.error("[AudioWS] Thread crashed (input transcription): #{e.class}: #{e.message}")
      end

      send_json(browser_ws, type: 'transcription', speaker: 'candidate',
                            text: text, turn_number: turn_number)

      check_time_ceiling(session, state, browser_ws)
    }
  end

  # Inject coverage only during GENUINE candidate turns; on_input_transcription also fires from
  # generationComplete when Gemini flushes mid-model-turn, which would trigger a dual response.
  def maybe_inject_coverage(state, session)
    return if state.model_speaking
    return unless state.cached_coverage_text.present?
    return if state.last_coverage_digest == state.last_injected_digest

    return unless state.gemini_client.inject_context(state.cached_coverage_text)

    state.last_injected_digest = state.last_coverage_digest
    Rails.logger.debug("[AudioWS] Coverage injected (digest=#{state.last_coverage_digest&.slice(0, 8)})")
  end

  # If the AI ended its last turn with a question, piggyback the wrap-up signal on the candidate's
  # next turn so the AI's response to their answer is the closing rather than another question.
  def maybe_piggyback_wrap_up(state, session)
    return unless state.waiting_for_candidate_response && !state.wrap_up_injected
    return unless state.gemini_client.inject_context(WRAP_UP_SIGNAL)

    state.wrap_up_injected = true
    state.waiting_for_candidate_response = false
    state.coverage_end_timer&.cancel
    Rails.logger.info("[AudioWS] Candidate responded — wrap-up piggybacked on coverage injection (session=#{session.id})")
  end

  def build_on_output_transcription(browser_ws, state, session)
    lambda { |text|
      next unless text.present?

      text = sanitize_output_transcription(text)
      next unless text.present?

      turn_number = state.increment_turn!

      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          save_transcript_turn(session, turn_number, 'ai', text)
        end
      rescue StandardError => e
        Rails.logger.error("[AudioWS] Thread crashed (output transcription): #{e.class}: #{e.message}")
      end

      send_json(browser_ws, type: 'transcription', speaker: 'ai',
                            text: text, turn_number: turn_number)

      # Track whether the AI's last turn ended with a question — drives wrap-up branching.
      state.last_ai_turn_ends_with_question = text.rstrip.end_with?('?')

      # Safety net: if AI said closing words, set coverage_pending and schedule a 15s fallback
      # finalizer in case on_model_turn_complete never fires (Gemini sometimes skips turnComplete).
      if !state.ending_scheduled && ai_closing_detected?(text)
        unless state.coverage_pending
          Rails.logger.warn("[AudioWS] AI closed without system signal — forcing coverage_pending (session=#{session.id})")
          state.coverage_pending = true
        end

        unless state.ending_scheduled
          EM.add_timer(15) do
            next if state.ending_scheduled
            Rails.logger.warn("[AudioWS] on_model_turn_complete delayed — finalizing via closing-phrase fallback (session=#{session.id})")
            state.ending_scheduled = true
            send_json(browser_ws, type: 'preparing_to_end', reason: 'all_covered')
            poll_for_session_end(browser_ws, state, session, attempts: 0)
          end
        end
      end

      check_time_ceiling(session, state, browser_ws)
    }
  end

  # Strips coverage/time metadata that leaks into output transcription via realtimeInput.text echoes.
  def sanitize_output_transcription(text)
    text = text.gsub(/\[COVERAGE[_ ]MAP\][\s\S]*?\[\/COVERAGE[_ ]MAP\]/m, '').strip
    text = text.gsub(/\[COVERAGE[_ ]MAP[^\]]*\]/m, '').strip
    text = text.sub(/\A\s*\{.*?"discovered"\s*:\s*\[.*?\].*?\}\s*/m, '').strip
    # Skip up to the last }] (or }) immediately followed by an uppercase letter — covers partial JSON echoes.
    text = text.sub(/\A[\s\S]*?[\}\]]+[\s\}\]]*(?=\p{Lu})/m, '').strip
    text = text.gsub(/\[TIME[_ ]CONTROL[^\]]*\][^\n]*/m, '').strip
    text = text.gsub(/pacing=\S+\s*priority_next=\S*/m, '').strip
    text = text.gsub(/\[Start the interview[^\]]*\]/m, '').strip
    text = text.gsub(/\[SESSION RESUME\][^\n]*/m, '').strip
    text.gsub(/\[SISTEM\][^\n]*/m, '').strip
  end

  # Fires after the model's turnComplete — safe to tell the frontend to unmute the mic.
  def build_on_model_turn_complete(browser_ws, state, session)
    lambda {
      Rails.logger.info("[AudioWS] Model turn complete — ai_audio_chunks=#{state.ai_audio_chunks || 0} sending speaker_changed:candidate")
      state.model_speaking = false
      state.ai_audio_chunks = 0

      # Deferred proactive reconnect fires in the gap between AI response and candidate's next speech.
      if state.reconnect_after_turn
        state.reconnect_after_turn = false
        Rails.logger.info("[AudioWS] Executing deferred proactive reconnect (session=#{session.id})")
        initiate_proactive_reconnect(browser_ws, state)
      end

      send_json(browser_ws, type: 'speaker_changed', speaker: 'candidate')

      handle_coverage_auto_end(browser_ws, state, session)
    }
  end

  # Debounce DB writes — Gemini rotates the token every turn. A short interval keeps context loss small when a
  # browser reconnect arrives before the old connection's close event (handle_browser_close flushes otherwise).
  def build_on_resumption_token_update(state, session)
    lambda { |token|
      state.latest_resumption_token = token

      now = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      next if state.last_token_persisted_at && (now - state.last_token_persisted_at) < TOKEN_PERSIST_INTERVAL

      state.last_token_persisted_at = now
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          persist_resumption_token(state)
        end
      rescue StandardError => e
        Rails.logger.error("[AudioWS] Thread crashed (resumption token): #{e.class}: #{e.message}")
      end
    }
  end

  def build_on_ready(browser_ws, state, session)
    lambda {
      state.logged_not_ready = false
      if state.interview_started
        Rails.logger.info("[AudioWS] Gemini reconnected for session #{session.id}")
        state.reconnecting = false
        state.reconnect_attempts = 0
        send_json(browser_ws, type: 'reconnected')
        send_json(browser_ws, type: 'speaker_changed', speaker: 'candidate')
      else
        next unless begin_interview(browser_ws, state, session)
      end

      schedule_proactive_reconnect(browser_ws, state)
    }
  end

  # The interview only starts once Gemini is ready, so a failed handshake leaves the invitation untouched.
  # Also runs when a browser returns to a running interview: StartHandler then leaves the session as it is.
  # Returns false when this connection must not continue.
  def begin_interview(browser_ws, state, session)
    Sessions::StartHandler.new(session).call(connection_id: state.connection_id)
    return false unless session.active? # replaced or ended meanwhile; the ownership watch stops this connection

    state.start_timeout_timer&.cancel
    state.interview_started = true
    state.reconnecting = false
    state.reconnect_attempts = 0

    # Pre-compute coverage so the first candidate turn has context to inject (no stale/empty cache on turn 1).
    injector = Coverage::MapInjector.new(session)
    state.cached_coverage_text = injector.injection_text
    state.last_coverage_digest = injector.coverage_fingerprint

    Rails.logger.info("[AudioWS] Gemini ready — sending session_started for session #{session.id}")
    resumed = session.gemini_resumption_token.present?
    unless resumed
      state.model_speaking = true
      send_json(browser_ws, type: 'speaker_changed', speaker: 'ai')
      state.gemini_client.trigger_opening
    end
    send_json(browser_ws, type: 'session_started', session_id: session.id, resumed: resumed)
    true
  rescue StandardError => e
    Rails.logger.error("[AudioWS] Could not begin interview: session=#{session.id} #{e.class}: #{e.message}")
    fail_interview_start(browser_ws, state)
    false
  end

  # Covers a handshake that never answers: Gemini closing the socket is handled by handle_gemini_close.
  def start_interview_timeout(browser_ws, state)
    return unless state.session.pending?

    state.start_timeout_timer = EM::Timer.new(START_TIMEOUT) do
      next if state.retired || state.interview_started

      Rails.logger.error("[AudioWS] Gemini not ready after #{START_TIMEOUT}s — session #{state.session.id}")
      fail_interview_start(browser_ws, state)
    end
  end

  # Leaves the session as it is: the candidate can try again with the same invitation.
  def fail_interview_start(browser_ws, state)
    Rails.logger.error("[AudioWS] Interview could not start: session=#{state.session.id}")
    shutdown_connection(state)
    send_json(browser_ws, type: 'start_failed', code: 'ai_unavailable')
    close_browser_after_delivery(browser_ws)
  end

  # Handles Gemini GoAway — transparent reconnection using resumption token, audio buffered for replay.
  def handle_go_away(browser_ws, state, resumption_token)
    session = state.session
    return unless resumption_token.present?

    Rails.logger.info("[AudioWS] GoAway received for session #{session.id} — reconnecting")

    state.proactive_reconnect_timer&.cancel
    state.reconnecting = true
    send_json(browser_ws, type: 'reconnecting')

    # Reset model_speaking so frontend doesn't stay stuck in muted/AI-speaking state post-reconnect.
    if state.model_speaking
      state.model_speaking = false
      send_json(browser_ws, type: 'speaker_changed', speaker: 'candidate')
    end

    state.latest_resumption_token = resumption_token
    persist_resumption_token(state)

    old_client = state.gemini_client
    old_client&.supersede!

    build_gemini_client(browser_ws, state)
    state.gemini_client.connect(resumption_handle: resumption_token)
    old_client&.close
  end

  # Handles unexpected Gemini WebSocket close (not GoAway). Audio is buffered during the gap and replayed.
  def handle_gemini_close(browser_ws, state, code:, reason:)
    # Normal close (1000) is intentional unless flagged as inactivity_close (which also uses 1000).
    return if code == 1000 && !state.gemini_client&.inactivity_close

    state.proactive_reconnect_timer&.cancel
    state.reconnect_attempts ||= 0

    if state.reconnect_attempts < MAX_RECONNECT_ATTEMPTS
      schedule_gemini_reconnect(browser_ws, state, code)
    elsif state.session.pending?
      fail_interview_start(browser_ws, state)
    else
      Rails.logger.error("[AudioWS] Gemini reconnection failed after #{MAX_RECONNECT_ATTEMPTS} attempts")
      Sessions::EndHandler.new(state.session).call(reason: 'error', connection_id: state.connection_id)
      return unless state.session.ended? # replaced by a newer connection; the ownership watch retires this one

      shutdown_connection(state)
      send_json(browser_ws, type: 'session_ended', reason: 'error',
                            message: 'The session encountered a problem. Please contact the interviewer.')
      browser_ws.close
    end
  end

  def schedule_gemini_reconnect(browser_ws, state, code)
    backoff = RECONNECT_BACKOFF[state.reconnect_attempts] || 4
    state.reconnect_attempts += 1
    state.reconnecting = true

    Rails.logger.warn("[AudioWS] Gemini closed unexpectedly (code=#{code}) — retry #{state.reconnect_attempts}/#{MAX_RECONNECT_ATTEMPTS} in #{backoff}s")
    # Before the interview starts the candidate is still on "Connecting...", so there is nothing to reconnect.
    send_json(browser_ws, type: 'reconnecting') if state.reconnect_attempts == 1 && !state.session.pending?
    if state.model_speaking
      state.model_speaking = false
      send_json(browser_ws, type: 'speaker_changed', speaker: 'candidate')
    end

    expected_client = state.gemini_client
    EM.add_timer(backoff) do
      next unless state.gemini_client.equal?(expected_client)
      next if state.retired

      state.gemini_client&.supersede!
      build_gemini_client(browser_ws, state)
      token = state.latest_resumption_token || state.session.gemini_resumption_token.presence
      state.gemini_client.connect(resumption_handle: token)
    end
  end

  def handle_browser_message(data, browser_ws, state)
    return if state.retired

    message = JSON.parse(data)

    case message['type']
    when 'debug_force_reconnect'
      if Rails.env.development?
        Rails.logger.warn("[AudioWS] DEBUG: forcing Gemini disconnect for session #{state.session&.id}")
        old_client = state.gemini_client
        handle_gemini_close(browser_ws, state, code: 1011, reason: 'debug_force_reconnect')
        old_client&.close
      end
    when 'end_session'
      # Shut down first: it flushes buffered transcription, so the candidate's last words reach the portfolio.
      shutdown_connection(state)
      Sessions::EndHandler.new(state.session).call(reason: 'manual_candidate', connection_id: state.connection_id)
      send_json(browser_ws, type: 'session_ended', reason: 'manual_candidate')
      browser_ws.close
    end
  rescue JSON::ParserError
    # ignore malformed control messages
  end

  # Schedules a proactive Gemini reconnect ~8.5min in, before Gemini's 10min hard limit triggers a 1011 close.
  def schedule_proactive_reconnect(browser_ws, state)
    state.proactive_reconnect_timer&.cancel
    delay = PROACTIVE_RECONNECT_AFTER + rand(PROACTIVE_RECONNECT_JITTER)
    state.proactive_reconnect_timer = EM::Timer.new(delay) do
      initiate_proactive_reconnect(browser_ws, state)
    end
    Rails.logger.info("[AudioWS] Proactive reconnect scheduled in #{delay}s for session #{state.session.id}")
  end

  # Starts a new Gemini connection while the old one is still live; swaps in on_ready and replays audio.
  def initiate_proactive_reconnect(browser_ws, state)
    if state.reconnecting
      Rails.logger.info("[AudioWS] Proactive reconnect skipped — already reconnecting (session #{state.session.id})")
      return
    end

    token = state.latest_resumption_token || state.session.gemini_resumption_token.presence

    unless token.present?
      Rails.logger.warn("[AudioWS] Proactive reconnect: no token yet, rescheduling (session #{state.session.id})")
      schedule_proactive_reconnect(browser_ws, state)
      return
    end

    # Don't interrupt mid-conversation — defer until AI finishes its current response.
    if state.model_speaking
      Rails.logger.info("[AudioWS] Proactive reconnect deferred — AI speaking (session #{state.session.id})")
      state.reconnect_after_turn = true
      return
    end

    # If candidate may still be speaking (silence pump not active), defer until next model turn.
    if state.gemini_client&.connected && !state.gemini_client&.silence_pumping?
      Rails.logger.info("[AudioWS] Proactive reconnect deferred — candidate may be speaking (session #{state.session.id})")
      state.reconnect_after_turn = true
      return
    end

    Rails.logger.info("[AudioWS] Initiating proactive reconnect for session #{state.session.id}")
    state.reconnecting = true

    if state.model_speaking
      state.model_speaking = false
      send_json(browser_ws, type: 'speaker_changed', speaker: 'candidate')
    end

    state.latest_resumption_token = token
    persist_resumption_token(state)

    old_client = state.gemini_client
    old_client&.supersede!
    build_gemini_client(browser_ws, state)
    state.gemini_client.connect(resumption_handle: token)
    # Close old connection after new one is set up to minimise the gap.
    EM.add_timer(2) { old_client&.close }
  end

  # Cancellable EM timer (vs Thread.new+sleep) — releases on session end without holding a thread for 2min.
  def schedule_graceful_end(browser_ws, state)
    return unless state.session

    state.graceful_end_timer = EM::Timer.new(BROWSER_GRACE_PERIOD) do
      next if state.retired

      # Either this connection was replaced or the session is ending: Gemini is not needed in both cases.
      shutdown_connection(state)

      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          Rails.logger.info("[AudioWS] Grace period expired for session #{state.session.id}")
          # Fenced: a reconnect that claimed the session after the last ownership check keeps it alive.
          Sessions::EndHandler.new(state.session).call(reason: 'error', connection_id: state.connection_id)
        end
      rescue StandardError => e
        Rails.logger.error("[AudioWS] Thread crashed (graceful end): #{e.class}: #{e.message}")
      end
    end
  end

  # Polls the database because the connection that replaces this one may live in another Puma worker.
  def start_ownership_watch(browser_ws, state)
    state.ownership_timer = EM::PeriodicTimer.new(OWNERSHIP_CHECK_INTERVAL) do
      check_ownership(browser_ws, state)
    end
  end

  def check_ownership(browser_ws, state)
    return if state.ownership_check_running || state.retired

    state.ownership_check_running = true
    Thread.new do
      owner, status, end_reason = ActiveRecord::Base.connection_pool.with_connection do
        Session.unscoped.where(id: state.session.id).pick(:active_connection_id, :status, :end_reason)
      end

      EM.schedule do
        state.ownership_check_running = false
        next if state.retired

        if status == 'ended'
          Rails.logger.info("[AudioWS] Session #{state.session.id} ended elsewhere — closing connection")
          close_session_after_end(browser_ws, state, reason: end_reason)
        elsif owner != state.connection_id
          retire_replaced_connection(browser_ws, state)
        end
      end
    rescue StandardError => e
      state.ownership_check_running = false
      Rails.logger.error("[AudioWS] Ownership check failed: #{e.class}: #{e.message}")
    end
  end

  def retire_replaced_connection(browser_ws, state)
    Rails.logger.info("[AudioWS] Connection replaced — retiring old connection for session #{state.session.id}")
    shutdown_connection(state)
    send_json(browser_ws, type: 'session_superseded')
    close_browser_after_delivery(browser_ws)
  end

  # Makes this connection inert: no timer can act for the session and Gemini is flushed and closed.
  def shutdown_connection(state)
    state.retired = true
    state.ending_scheduled = true
    [state.proactive_reconnect_timer, state.graceful_end_timer, state.time_ceiling_timer,
     state.coverage_end_timer, state.ownership_timer, state.start_timeout_timer].each { |timer| timer&.cancel }

    client = state.gemini_client
    client&.supersede!
    client&.close
  end

  # Only the owning connection may write: a replaced connection must not roll the token back.
  def persist_resumption_token(state)
    token = state.latest_resumption_token
    return unless token.present? && state.session

    Session.unscoped.where(id: state.session.id, active_connection_id: state.connection_id)
           .update_all(gemini_resumption_token: token)
  end

  # 300ms delay lets the frontend process the last JSON message before the close event fires,
  # otherwise it shows the reconnection UI instead of the final screen.
  def close_browser_after_delivery(browser_ws)
    EM.add_timer(0.3) do
      begin
        browser_ws.close
      rescue StandardError
        nil
      end
    end
  end

  # Sends session_ended then closes both connections.
  def close_session_after_end(browser_ws, state, reason:)
    EM.schedule do
      shutdown_connection(state)
      send_json(browser_ws, type: 'session_ended', reason: reason)
      close_browser_after_delivery(browser_ws)
    end
  end

  # Only flags pending — actual injection always deferred to handle_coverage_auto_end at a turn-safe point,
  # since model_speaking can be false while AI is mid-generation, which produced question+closing hybrids.
  def schedule_coverage_wrap_up(state, session)
    return if state.coverage_pending || state.ending_scheduled

    state.coverage_pending = true
    Rails.logger.info("[AudioWS] All skills covered — wrap-up pending next AI turn (session=#{session.id})")
  end

  # Coverage auto-end logic — called from on_model_turn_complete. Branches on whether AI closed naturally,
  # ended with a question (need wrap-up signal), or already delivered the post-signal closing.
  def handle_coverage_auto_end(browser_ws, state, session)
    # Safety net: if we injected wrap_up but coverage_pending somehow wasn't set, recover.
    state.coverage_pending = true if state.wrap_up_injected && !state.coverage_pending

    return unless state.coverage_pending && !state.ending_scheduled

    if state.wrap_up_injected
      finalize_after_wrap_up(browser_ws, state, session)
    elsif state.last_ai_turn_ends_with_question
      wait_for_candidate_then_wrap_up(state, session)
    else
      finalize_natural_close(browser_ws, state, session)
    end
  end

  def finalize_after_wrap_up(browser_ws, state, session)
    state.coverage_end_timer&.cancel
    state.ending_scheduled = true
    Rails.logger.info("[AudioWS] Wrap-up turn complete — finalizing session #{session.id}")
    send_json(browser_ws, type: 'preparing_to_end', reason: 'all_covered')
    poll_for_session_end(browser_ws, state, session, attempts: 0)
  end

  # Wait for candidate response before injecting wrap-up so silence pump doesn't fire premature close;
  # 20s fallback in case candidate stays silent.
  def wait_for_candidate_then_wrap_up(state, session)
    state.waiting_for_candidate_response = true
    Rails.logger.info("[AudioWS] AI ended with question — waiting for candidate response before wrap-up (session=#{session.id})")

    state.coverage_end_timer&.cancel
    state.coverage_end_timer = EM::Timer.new(20) do
      next if state.ending_scheduled || state.wrap_up_injected

      delivered = state.gemini_client&.inject_context(WRAP_UP_SIGNAL)
      if delivered
        state.wrap_up_injected = true
        state.waiting_for_candidate_response = false
        Rails.logger.info("[AudioWS] Candidate silent — wrap-up injected via fallback (session=#{session.id})")
      end
    end
  end

  def finalize_natural_close(browser_ws, state, session)
    state.coverage_end_timer&.cancel
    state.ending_scheduled = true
    Rails.logger.info("[AudioWS] AI closed naturally — finalizing session #{session.id}")
    send_json(browser_ws, type: 'preparing_to_end', reason: 'all_covered')
    poll_for_session_end(browser_ws, state, session, attempts: 0)
  end

  # Polls until the session is ended (via audio_complete API call) or max_attempts is reached.
  def poll_for_session_end(browser_ws, state, session, attempts:)
    max_attempts = 30

    EM.add_timer(1) do
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          if session.reload.ended?
            Rails.logger.info("[AudioWS] Session #{session.id} ended via audio_complete — closing WebSocket")
            close_session_after_end(browser_ws, state, reason: 'all_covered')
          elsif attempts >= max_attempts
            Rails.logger.warn("[AudioWS] audio_complete poll timed out — ending session #{session.id} directly")
            Sessions::EndHandler.new(session).call(reason: 'all_covered', connection_id: state.connection_id)
            close_session_after_end(browser_ws, state, reason: 'all_covered')
          else
            EM.schedule { poll_for_session_end(browser_ws, state, session, attempts: attempts + 1) }
          end
        end
      rescue StandardError => e
        Rails.logger.error("[AudioWS] Thread crashed (poll session end): #{e.class}: #{e.message}")
      end
    end
  end

  # Refreshes cached coverage text from a background thread; assigns digest+text atomically on EM thread
  # to prevent a GVL preemption from pairing a new digest with stale text.
  def refresh_coverage_cache(session, state)
    started  = Process.clock_gettime(Process::CLOCK_MONOTONIC, :millisecond)
    injector = Coverage::MapInjector.new(session)

    fingerprint = injector.coverage_fingerprint
    if state.last_coverage_digest == fingerprint
      Rails.logger.debug("[AudioWS] Coverage unchanged — cache still valid (session=#{session.id})")
      return
    end

    text        = injector.injection_text
    all_covered = injector.all_covered?
    elapsed     = Process.clock_gettime(Process::CLOCK_MONOTONIC, :millisecond) - started

    EM.schedule do
      state.last_coverage_digest = fingerprint
      state.cached_coverage_text = text

      schedule_coverage_wrap_up(state, session) if all_covered
    end

    Rails.logger.warn("[AudioWS] Coverage cache refresh slow: #{elapsed}ms (session=#{session.id})") if elapsed > 50
    Rails.logger.debug("[AudioWS] Coverage cache refreshed in #{elapsed}ms")
  rescue StandardError => e
    Rails.logger.error("[AudioWS] Coverage cache refresh failed: #{e.message}")
  end

  # Returns the turn number actually stored, or nil if nothing new was stored. During a takeover the old and
  # new connection can pick the same number; only an identical turn is a duplicate, anything else moves on.
  def save_transcript_turn(session, turn_number, speaker, text)
    attempts = 0

    begin
      session.transcript_turns.create!(turn_number: turn_number, speaker: speaker, text: text)
      turn_number
    rescue ActiveRecord::RecordNotUnique
      return nil if session.transcript_turns.exists?(turn_number: turn_number, speaker: speaker, text: text)

      attempts += 1
      if attempts > MAX_TURN_NUMBER_RETRIES
        Rails.logger.error("[AudioWS] Could not store transcript turn for session #{session.id}: turn number conflict")
        return nil
      end

      turn_number = session.transcript_turns.maximum(:turn_number).to_i + 1
      retry
    end
  rescue StandardError => e
    Rails.logger.error("[AudioWS] Failed to save transcript turn: #{e.message}")
  end

  def check_time_ceiling(session, state, browser_ws)
    return unless session.started_at && session.assessment.time_limit_min
    return if state.ending_scheduled

    elapsed   = (Time.current - session.started_at).to_i
    limit     = session.assessment.time_limit_min * 60
    remaining = limit - elapsed

    if remaining <= 0
      enforce_time_ceiling(session, state, browser_ws)
    elsif remaining <= 60 && !state.sent_time_warnings.include?(:warn_60)
      mark_warning_if_delivered(state, :warn_60,
        "[TIME CONTROL:#{SYSTEM_SIGNAL_TOKEN}] { \"wrap_up\": true }")
    elsif remaining <= 120 && !state.sent_time_warnings.include?(:warn_120)
      mark_warning_if_delivered(state, :warn_120,
        "[TIME CONTROL:#{SYSTEM_SIGNAL_TOKEN}] { \"time_warning\": true }")
    end
  end

  def enforce_time_ceiling(session, state, browser_ws)
    # Mark :ceiling sent only if inject_context actually delivered — silence pump can return false (C2 fix).
    mark_warning_if_delivered(state, :ceiling,
      "[TIME CONTROL:#{SYSTEM_SIGNAL_TOKEN}] { \"time_warning\": true, \"wrap_up\": true }")

    state.ending_scheduled = true

    state.time_ceiling_timer = EM::Timer.new(60) do
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          next if session.reload.ended?

          Sessions::EndHandler.new(session).call(reason: 'time_ceiling', connection_id: state.connection_id)
          close_session_after_end(browser_ws, state, reason: 'time_ceiling')
        end
      rescue StandardError => e
        Rails.logger.error("[AudioWS] Thread crashed (time ceiling): #{e.class}: #{e.message}")
      end
    end
  end

  def mark_warning_if_delivered(state, key, signal)
    return if state.sent_time_warnings.include?(key)
    return unless state.gemini_client.inject_context(signal)

    state.sent_time_warnings.add(key)
  end

  CLOSING_PHRASES = [
    # English
    'you\'ll hear back from the team',
    'you\'ll hear from the team',
    'thank you for your time',
    'thanks for your time',
    'that concludes our interview',
    'that\'s all for today',
    'good luck',
    # Indonesian — formal (Anda) and informal (kamu), partial matches cover variations
    'akan mendengar kabar',           # covers "Anda/kamu akan mendengar kabar dari tim / selanjutnya"
    'terima kasih atas waktu',        # covers "waktumu", "waktunya", "waktu Anda"
    'terima kasih banyak atas waktu',
    'semoga sukses',
    'sampai jumpa',
    'sampai bertemu lagi',
    'sesi wawancara ini telah selesai',
    'wawancara kita sudah selesai'
  ].freeze

  def ai_closing_detected?(text)
    downcased = text.downcase
    CLOSING_PHRASES.any? { |phrase| downcased.include?(phrase) }
  end

  def authenticate_and_load(env, session_id)
    request = Rack::Request.new(env)

    session = begin
      invite_token = request.params['token']

      if invite_token.present?
        Session.unscoped.find_by(invite_token: invite_token)
      else
        auth_header = env['HTTP_AUTHORIZATION']
        return [nil, 'Missing authorization'] unless auth_header.present?

        token = auth_header.split(' ').last
        payload = JsonWebToken.decode(token)
        tenant_id = Organization.find_by(scheme: payload[:scheme])&.id
        return [nil, 'Invalid tenant'] unless tenant_id

        Session.unscoped.where(tenant_id: tenant_id).find_by(id: session_id)
      end
    rescue StandardError => e
      return [nil, "Authentication failed: #{e.message}"]
    end

    return [nil, 'Session not found'] unless session
    return [nil, 'Session ID mismatch'] if session.id.to_s != session_id
    return [session, 'Session has ended'] if session.ended?

    [session, nil]
  end

  def send_json(ws, **payload)
    ws.send(payload.to_json)
  rescue StandardError => e
    # speaker_changed / session_ended failures are critical for frontend state — log at WARN.
    level = %w[speaker_changed session_started session_ended].include?(payload[:type]) ? :warn : :debug
    Rails.logger.public_send(level, "[AudioWS] Failed to send JSON (type=#{payload[:type]}): #{e.message}")
  end

  # Per-connection state shared across callbacks.
  class ConnectionState
    attr_reader :connection_id
    attr_accessor :session, :gemini_client, :turn_counter,
                  :ownership_timer, :ownership_check_running, :retired,
                  :interview_started, :start_timeout_timer,
                  :reconnect_attempts, :browser_disconnected_at,
                  :proactive_reconnect_timer,
                  :latest_resumption_token,
                  :reconnecting, :last_token_persisted_at,
                  :ending_scheduled, :logged_not_ready,
                  :model_speaking, :last_coverage_digest,
                  :sent_time_warnings, :ai_audio_chunks,
                  :cached_coverage_text, :last_injected_digest,
                  :logged_gate_suppressed, :reconnect_after_turn,
                  :graceful_end_timer, :time_ceiling_timer,
                  :coverage_end_timer, :coverage_pending,
                  :last_ai_turn_ends_with_question, :wrap_up_injected,
                  :waiting_for_candidate_response

    def initialize
      @connection_id = SecureRandom.uuid
      @retired = false
      @interview_started = false
      @turn_counter = 0
      @reconnect_attempts = 0
      @reconnecting = false
      @model_speaking = false
      @wrap_up_injected = false
      @last_ai_turn_ends_with_question = false
      @waiting_for_candidate_response = false
      @sent_time_warnings = Set.new
    end

    def increment_turn!
      @turn_counter += 1
    end
  end
end
