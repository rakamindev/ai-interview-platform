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
      # Allow upgrading end_reason from 'error' to a manual reason (candidate/assessor ended cleanly)
      if @session.ended?
        manual = %w[manual_candidate manual_assessor]
        if manual.include?(reason.to_s) && @session.end_reason == 'error'
          @session.update_column(:end_reason, reason.to_s)
        end
        return @session
      end

      reason = 'manual_assessor' unless VALID_REASONS.include?(reason.to_s)

      ActiveRecord::Base.transaction do
        duration = @session.started_at ? (Time.current - @session.started_at).to_i : nil

        @session.update!(
          status:           'ended',
          end_reason:       reason.to_s,
          ended_at:         Time.current,
          duration_seconds: duration
        )

        create_portfolio
        supersede_pending_sessions if successful_completion?(reason.to_s)
      end

      enqueue_portfolio_generation
      publish_status_update
      Rails.logger.info("[N9/EndHandler] Session #{@session.id} ended (reason=#{reason})")

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
      # Idempotent — only create if one doesn't exist yet
      return if @session.portfolio.present?

      @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )
    end

    # A session completed successfully — any other PENDING session for the
    # same candidate (same assessment) should be marked superseded so they
    # can't be used for a duplicate interview.
    #
    # Identity priority: candidate_id > candidate_email > (none — don't group by name alone)
    # Only supersedes within the same assessment to avoid cross-assessment collateral.
    def supersede_pending_sessions
      identity_scope = candidate_identity_scope
      return unless identity_scope

      siblings = identity_scope
                   .where(assessment_id: @session.assessment_id)
                   .where(status: 'pending')
                   .where.not(id: @session.id)

      return if siblings.empty?

      superseded_at = Time.current
      siblings.each do |sibling|
        sibling.update_columns(
          status:     'ended',
          end_reason: 'superseded',
          ended_at:   superseded_at
        )
        Rails.logger.info(
          "[EndHandler] Session #{sibling.id} superseded by #{@session.id} " \
          "(candidate_identity: #{@session.candidate_identity_key})"
        )
      end
    end

    # Only supersede on genuine completion — never on error or superseded itself.
    SUPERSEDE_ON_REASONS = %w[all_covered manual_candidate manual_assessor time_ceiling].freeze

    def successful_completion?(reason)
      SUPERSEDE_ON_REASONS.include?(reason)
    end

    # Returns an AR relation scoped to sessions with the same candidate identity,
    # or nil if the session has no usable identity (no id, no email).
    def candidate_identity_scope
      if @session.candidate_id.present?
        Session.unscoped.where(tenant_id: @session.tenant_id, candidate_id: @session.candidate_id)
      elsif @session.candidate_email.present?
        Session.unscoped.where(
          tenant_id:       @session.tenant_id,
          candidate_email: @session.candidate_email.downcase.strip
        )
      else
        nil # name-only sessions — cannot safely group
      end
    end

    def enqueue_portfolio_generation
      portfolio = @session.reload.portfolio
      return unless portfolio

      PortfolioGeneratorWorker.perform_async(@session.id)
      Rails.logger.info("[N9/EndHandler] Enqueued N10 for session #{@session.id}")
    end
  end
end
