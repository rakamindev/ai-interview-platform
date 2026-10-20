# frozen_string_literal: true

module Sessions
  # Handles session termination: closes the session record, creates the portfolio,
  # and enqueues the portfolio generation job (N10).
  # Called on: manual end, all_covered auto-end, time_ceiling, or error.
  class EndHandler
    VALID_REASONS         = Session::END_REASONS
    VALID_FAILURE_CLASSES = Session::FAILURE_CLASSES

    def initialize(session)
      @session = session
    end

    # failure_class records WHAT KIND of failure occurred, if any. It is
    # deliberately orthogonal to end_reason rather than a refinement of it: a
    # session can end by hitting its time ceiling and still have suffered a
    # provider outage halfway through, and an assessor needs to know that
    # even though the ending itself was normal. That also means a class
    # recorded earlier survives if the session is later upgraded to a clean
    # manual ending — it stays behind as evidence of what actually happened.
    def call(reason: 'manual_assessor', failure_class: nil)
      # Allow upgrading end_reason from 'error' to a manual reason (candidate/assessor ended cleanly)
      if @session.ended?
        manual = %w[manual_candidate manual_assessor]
        if manual.include?(reason.to_s) && @session.end_reason == 'error'
          @session.update_column(:end_reason, reason.to_s)
        end
        return @session
      end

      reason = 'manual_assessor' unless VALID_REASONS.include?(reason.to_s)
      # Anything outside the documented set is discarded rather than stored,
      # mirroring how an unknown reason falls back to manual_assessor above.
      failure_class = nil unless VALID_FAILURE_CLASSES.include?(failure_class.to_s)

      ActiveRecord::Base.transaction do
        duration = @session.started_at ? (Time.current - @session.started_at).to_i : nil

        @session.update!(
          status:           'ended',
          end_reason:       reason.to_s,
          failure_class:    failure_class,
          ended_at:         Time.current,
          duration_seconds: duration
        )

        create_portfolio
      end

      enqueue_portfolio_generation
      publish_status_update
      Rails.logger.info("[N9/EndHandler] Session #{@session.id} ended (reason=#{reason}, failure_class=#{failure_class.presence || 'none'})")

      @session
    end

    private

    def publish_status_update
      redis = ::Redis.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'))
      # failure_class rides along so the assessor's live view can say WHY a
      # session broke, not merely that it did.
      redis.publish("coverage:#{@session.id}", {
        type:          'session_status',
        status:        @session.status,
        end_reason:    @session.end_reason,
        failure_class: @session.failure_class
      }.to_json)
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
