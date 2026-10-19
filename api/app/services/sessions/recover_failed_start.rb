# frozen_string_literal: true

module Sessions
  # Re-opens invite links that ended with `error` before the candidate spoke —
  # e.g. misconfigured GEMINI_LIVE_MODEL. Avoids forcing a new invite for dev retries.
  class RecoverFailedStart
    def initialize(session)
      @session = session
    end

    def recoverable?
      @session.ended? &&
        @session.end_reason == 'error' &&
        !@session.transcript_turns.where(speaker: 'candidate').exists?
    end

    def call
      return false unless recoverable?

      ActiveRecord::Base.transaction do
        portfolio = @session.portfolio
        portfolio&.destroy if portfolio&.generation_status == 'pending'

        @session.update!(
          status:           'pending',
          end_reason:       nil,
          ended_at:         nil,
          duration_seconds: nil,
          started_at:       nil
        )

        @session.coverage_maps.update_all(state: 'not_yet', probe_count: 0)
      end

      Rails.logger.info("[RecoverFailedStart] Session #{@session.id} reset to pending after connect error")
      true
    end
  end
end
