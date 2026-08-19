# frozen_string_literal: true

module Portfolios
  # Recovers portfolios stranded in a non-terminal state (pending / generating)
  # after their generation job was lost (enqueue failure, Redis flush, worker
  # crash). Recovery is idempotent and safe to run concurrently:
  #
  #   * Candidate selection is conservative — a portfolio is only considered
  #     stuck when its most recent generation attempt is older than the TTL.
  #   * Each portfolio is reset to 'pending' under a row lock, so two sweeps or
  #     a sweep + read-time self-heal cannot double-enqueue: the second one sees
  #     a fresh generation_attempted_at and skips.
  #   * A legitimately running job is never touched, because its
  #     generation_attempted_at is recent while it works (best case runtime is
  #     ~2-5 minutes vs a 15 minute TTL).
  class Recovery
    def initialize(worker_class: PortfolioGeneratorWorker)
      @worker_class = worker_class
    end

    # Sweep API. Returns the records that were re-enqueued.
    # Intended for a periodic rake task / cron; never raises.
    def recover!(ttl_minutes: Portfolio::GENERATION_RECOVERY_TTL_MINUTES)
      threshold = Time.current - ttl_minutes.minutes

      candidates = Portfolio.pending.where(
        arel_stuck('pending', threshold)
      ) + Portfolio.generating.where(
        arel_stuck('generating', threshold)
      )

      candidates.filter_map do |portfolio|
        portfolio if recover_stuck!(portfolio, threshold: threshold)
      end
    end

    # Single-portfolio recovery used by the API's read-time self-heal.
    # Returns true when the portfolio was reset and re-enqueued.
    def recover_stuck!(portfolio, threshold: Time.current - Portfolio::GENERATION_RECOVERY_TTL_MINUTES.minutes)
      portfolio.with_lock do
        return false unless stuck?(portfolio, threshold: threshold)

        portfolio.update!(
          generation_status:       'pending',
          generation_attempted_at: Time.current,
          generation_error:        nil
        )
      end

      @worker_class.perform_async(portfolio.session_id)
      Rails.logger.info("[N10/Recovery] Re-enqueued generation for portfolio #{portfolio.id} (session #{portfolio.session_id})")
      true
    rescue => e
      Rails.logger.error("[N10/Recovery] Failed to recover portfolio #{portfolio.id}: #{e.class} #{e.message}")
      false
    end

    private

    def stuck?(portfolio, threshold:)
      case portfolio.generation_status
      when 'pending'
        stale_at = portfolio.generation_attempted_at.presence || portfolio.created_at
        stale_at < threshold
      when 'generating'
        portfolio.generation_attempted_at.present? && portfolio.generation_attempted_at < threshold
      else
        false
      end
    end

    def arel_stuck(status, threshold)
      table = Portfolio.arel_table
      if status == 'pending'
        attempted = table[:generation_attempted_at]
        table[:generation_status].eq('pending')
                                .and(
                                  attempted.eq(nil).and(table[:created_at].lt(threshold))
                                             .or(attempted.not_eq(nil).and(attempted.lt(threshold)))
                                )
      else
        table[:generation_status].eq(status)
                                  .and(table[:generation_attempted_at].lt(threshold))
      end
    end
  end
end