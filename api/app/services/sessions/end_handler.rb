# frozen_string_literal: true

module Sessions
  # Handles session termination: closes the session record, creates the portfolio,
  # and enqueues the portfolio generation job (N10).
  # Called on: manual end, all_covered auto-end, time_ceiling, or error.
  class EndHandler
    VALID_REASONS = Session::END_REASONS

    def initialize(session)
      @session = session
    end

    def call(reason: 'manual_assessor')
      return handle_already_ended(reason) if @session.ended?

      # Serialize concurrent end calls (audio_complete + assessor end_session +
      # auto-end can race). `with_lock` takes a row lock so only one caller can
      # mutate the session at a time; the second caller sees `ended?` and exits.
      @session.with_lock do
        return handle_already_ended(reason) if @session.ended?

        reason = 'manual_assessor' unless VALID_REASONS.include?(reason.to_s)

        duration = @session.started_at ? (Time.current - @session.started_at).to_i : nil

        @session.update!(
          status:           'ended',
          end_reason:       reason.to_s,
          ended_at:         Time.current,
          duration_seconds: duration
        )

        create_portfolio
      end

      enqueue_portfolio_generation
      publish_status_update
      Rails.logger.info("[N9/EndHandler] Session #{@session.id} ended (reason=#{reason})")

      @session
    rescue ActiveRecord::RecordNotUnique
      # Belt-and-suspenders: lost a race on portfolios.session_id unique index.
      # The concurrent caller already created the portfolio; treat as success.
      Rails.logger.warn("[N9/EndHandler] Concurrent end detected for session #{@session.id}; portfolio already created")
      @session.reload
    end

    private

    # Handles an already-ended session. Allows upgrading end_reason from
    # 'error' to a manual reason (candidate/assessor ended cleanly).
    def handle_already_ended(reason)
      if %w[manual_candidate manual_assessor].include?(reason.to_s) && @session.end_reason == 'error'
        @session.update_column(:end_reason, reason.to_s)
      end
      @session
    end

    def publish_status_update
      redis = ::Redis.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'))
      redis.publish("coverage:#{@session.id}", { type: 'session_status', status: @session.status, end_reason: @session.end_reason }.to_json)
    rescue => e
      Rails.logger.error("[EndHandler] Failed to publish status update: #{e.message}")
    ensure
      redis&.close
    end

    def create_portfolio
      # Idempotent — only create if one doesn't exist yet
      return if @session.portfolio.present?

      @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )
    end

    def enqueue_portfolio_generation
      portfolio = @session.reload.portfolio
      return unless portfolio

      PortfolioGeneratorWorker.perform_async(@session.id)
      Rails.logger.info("[N9/EndHandler] Enqueued N10 for session #{@session.id}")
    end
  end
end
