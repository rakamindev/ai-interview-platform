# frozen_string_literal: true

class PortfolioGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :portfolio, retry: 3

  sidekiq_retries_exhausted do |msg, _ex|
    session_id = msg['args'].first
    session = Session.find_by(id: session_id)
    session&.portfolio&.update(
      generation_status: 'failed',
      generation_error:  "Failed after #{msg['retry_count']} retries: #{msg['error_message']}"
    )
    Rails.logger.error("[N10] Portfolio generation permanently failed for session #{session_id}")
  end

  def perform(session_id)
    session = Session.find(session_id)
    # AC-B3 guard: if the candidate's consent was revoked (data deletion in
    # flight / data deleted), never regenerate a portfolio from that data —
    # this closes the race where a queued generation re-creates the portfolio
    # after CandidateDataDeletionJob removed it.
    unless session.consent_granted?
      return Rails.logger.warn("[N10] Session #{session_id} consent not granted — skipping generation")
    end

    Portfolios::Generator.new(session: session).call
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N10] Session #{session_id} not found — skipping")
  end
end
