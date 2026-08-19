# frozen_string_literal: true

module Sessions
  # Handles session termination: closes the session record, creates the portfolio,
  # and enqueues the portfolio generation job (N10).
  # Called on: manual end, all_covered auto-end, time_ceiling, or error.
  #
  # Concurrency contract:
  #   The whole termination is serialized on the session row (with_lock) so that
  #   exactly one caller transitions pending -> ended and creates the portfolio.
  #   Later/repeated calls become no-ops. This removes the P1 race where two
  #   concurrent ends hit the portfolios.session_id unique index (RecordNotUnique
  #   -> 500) or enqueue two generation jobs.
  class EndHandler
    VALID_REASONS = Session::END_REASONS

    # Entry points that mean a human drove a clean ending (used to upgrade an
    # earlier terminal 'error' state so reports show the true reason).
    MANUAL_REASONS = %w[manual_candidate manual_assessor].freeze

    def initialize(session)
      @session = session
    end

    def call(reason: 'manual_assessor')
      reason = 'manual_assessor' unless VALID_REASONS.include?(reason.to_s)

      transitioned = false

      @session.with_lock do
        if @session.ended?
          # Allow upgrading end_reason from 'error' to a manual reason
          if MANUAL_REASONS.include?(reason.to_s) && @session.end_reason == 'error'
            @session.update_column(:end_reason, reason.to_s)
            # No re-enqueue here: the portfolio state is unchanged from the
            # original ending; recovery / read-time self-heal owns retries.
          end
        else
          duration = @session.started_at ? (Time.current - @session.started_at).to_i : nil

          @session.update!(
            status:           'ended',
            end_reason:       reason.to_s,
            ended_at:         Time.current,
            duration_seconds: duration
          )

          create_portfolio
          transitioned = true
        end
      end

      if transitioned
        safe_enqueue_portfolio_generation
        publish_status_update
        Rails.logger.info("[N9/EndHandler] Session #{@session.id} ended (reason=#{reason})")
      end

      @session
    end

    private

    def publish_status_update
      redis = ::Redis.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'))
      redis.publish("coverage:#{@session.id}", { type: 'session_status', status: @session.status, end_reason: @session.end_reason }.to_json)
    rescue => e
      Rails.logger.error("[EndHandler] Failed to publish status update: #{e.message}")
    ensure
      redis&.close
    end

    def create_portfolio
      # Only called while holding the session row lock, so this check-then-create
      # is safe from concurrent double-creation.
      return if @session.portfolio.present?

      @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )
    end

    # Enqueue after the transaction has committed (a job started before commit
    # would query pre-commit state). If the enqueue itself fails (e.g. Redis
    # briefly unavailable), we do NOT roll the session back to an error or 500
    # the client — the portfolio is left 'pending' and the recovery sweep /
    # read-time self-heal re-enqueues it.
    def safe_enqueue_portfolio_generation
      portfolio = @session.reload.portfolio
      return unless portfolio

      PortfolioGeneratorWorker.perform_async(@session.id)
      Rails.logger.info("[N9/EndHandler] Enqueued N10 for session #{@session.id}")
    rescue => e
      Rails.logger.error(
        "[N9/EndHandler] Failed to enqueue N10 for session #{@session.id}: #{e.message}. " \
        'Portfolio left pending; recovery will re-enqueue.'
      )
    end
  end
end