# frozen_string_literal: true

module Sessions
  # Handles a technical failure of the interview (Gemini unreachable, grace-period timeout).
  # Unlike EndHandler, this NEVER generates a portfolio and NEVER marks the session `ended`.
  #
  # Two outcomes (wiki 04-step4-revamp.md §5, hybrid A+B):
  #   :reset  — the candidate had not answered yet (no transcript), so the session goes back to
  #             `pending` and the same invite link can start over (self-service retry).
  #   :failed — the interview had real content, so it is marked `failed` (terminal), the transcript
  #             is kept, and the assessor re-invites. No auto-portfolio.
  #   :noop   — the session was already terminal (idempotent against duplicate close events).
  class FailureHandler
    def initialize(session)
      @session = session
    end

    def call(reason: 'error')
      return :noop if @session.terminal?

      resettable? ? reset! : fail!(reason)
    end

    private

    # A failure "before the first answer": nothing the candidate said exists yet.
    def resettable?
      @session.transcript_turns.none?
    end

    def reset!
      @session.update!(
        status:                  'pending',
        started_at:              nil,
        gemini_resumption_token: nil
      )
      publish_status_update
      Rails.logger.info("[FailureHandler] Session #{@session.id} reset to pending for retry (no transcript)")
      :reset
    end

    def fail!(reason)
      duration = @session.started_at ? (Time.current - @session.started_at).to_i : nil

      @session.update!(
        status:           'failed',
        end_reason:       reason.to_s,
        ended_at:         Time.current,
        duration_seconds: duration
      )
      publish_status_update
      Rails.logger.info("[FailureHandler] Session #{@session.id} marked failed (reason=#{reason}); no portfolio generated")
      :failed
    end

    # Mirrors EndHandler/StartHandler so the live monitor updates. Non-critical: never fail the
    # request over a Redis hiccup.
    def publish_status_update
      redis = ::Redis.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'))
      redis.publish(
        "coverage:#{@session.id}",
        { type: 'session_status', status: @session.status, end_reason: @session.end_reason }.to_json
      )
    rescue StandardError => e
      Rails.logger.error("[FailureHandler] Failed to publish status update: #{e.message}")
    ensure
      redis&.close
    end
  end
end
