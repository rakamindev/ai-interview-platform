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
      reason = 'manual_assessor' unless VALID_REASONS.include?(reason.to_s)
      newly_ended = false

      @session.with_lock do
        if @session.ended?
          manual = %w[manual_candidate manual_assessor]
          if manual.include?(reason.to_s) && @session.end_reason == 'error'
            @session.update_column(:end_reason, reason.to_s)
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
          newly_ended = true
        end
      end

      if newly_ended
        enqueue_portfolio_generation
        publish_status_update
        Rails.logger.info("[N9/EndHandler] Session #{@session.id} ended (reason=#{reason})")
      end

      @session
    end

    private

    def publish_status_update
      Sidekiq.redis do |conn|
        conn.publish(
          "coverage:#{@session.id}",
          { type: 'session_status', status: @session.status, end_reason: @session.end_reason }.to_json
        )
      end
    rescue => e
      Rails.logger.error("[EndHandler] Failed to publish status update: #{e.message}")
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
