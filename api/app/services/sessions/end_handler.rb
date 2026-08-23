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

    def call(reason: "manual_assessor")
      # Allow upgrading end_reason from 'error' to a manual reason (candidate/assessor ended cleanly)
      if @session.ended?
        manual = %w[manual_candidate manual_assessor]
        @session.update_column(:end_reason, reason.to_s) if manual.include?(reason.to_s) && @session.end_reason == "error"
        return @session
      end

      reason = "manual_assessor" unless VALID_REASONS.include?(reason.to_s)

      # Guard against a stale in-memory session whose row was deleted concurrently
      # (e.g. dev DB reset while a websocket connection is still open). A plain
      # #update! on a missing row is a silent no-op (no optimistic-lock column on
      # sessions), so without this the FK violation surfaces later in create_portfolio.
      begin
        @session.reload
      rescue ActiveRecord::RecordNotFound
        Rails.logger.error("[N9/EndHandler] Session #{@session.id} no longer exists, skipping end")
        return @session
      end

      ActiveRecord::Base.transaction do
        duration = @session.started_at ? (Time.current - @session.started_at).to_i : nil

        @session.update!(
          status: "ended",
          end_reason: reason.to_s,
          ended_at: Time.current,
          duration_seconds: duration
        )

        create_portfolio
      end

      enqueue_portfolio_generation
      publish_status_update
      send_session_completed_notification
      Rails.logger.info("[N9/EndHandler] Session #{@session.id} ended (reason=#{reason})")

      @session
    end

    private

    def publish_status_update
      redis = ::Redis.new(url: ENV.fetch("REDIS_URL", "redis://localhost:6379/1"))
      redis.publish("coverage:#{@session.id}",
                    { type: "session_status", status: @session.status, end_reason: @session.end_reason }.to_json)
    rescue StandardError => e
      Rails.logger.error("[EndHandler] Failed to publish status update: #{e.message}")
    ensure
      redis&.close
    end

    def create_portfolio
      # Idempotent — only create if one doesn't exist yet
      return if @session.portfolio.present?

      @session.create_portfolio!(
        candidate_id: @session.candidate_id,
        generation_status: "pending",
        tenant_id: @session.tenant_id
      )
    end

    def enqueue_portfolio_generation
      portfolio = @session.reload.portfolio
      return unless portfolio

      PortfolioGeneratorWorker.perform_async(@session.id)
      Rails.logger.info("[N9/EndHandler] Enqueued N10 for session #{@session.id}")
    end

    def send_session_completed_notification
      assessment = @session.assessment
      AssessmentMailer.session_completed(assessment, @session).deliver_later
    rescue StandardError => e
      Rails.logger.error("[EndHandler] Failed to send session completed email: #{e.message}")
    end
  end
end
