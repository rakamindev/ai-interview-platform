# frozen_string_literal: true

class PortfolioGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :portfolio, retry: 3

  sidekiq_retries_exhausted do |msg, _ex|
    session_id = msg['args'].first
    portfolio  = Session.find_by(id: session_id)&.portfolio

    # A duplicate job may have finished the portfolio meanwhile: never overwrite a finished result.
    # The raw error message is not stored because it can echo candidate data.
    if portfolio && !portfolio.complete?
      portfolio.update(
        generation_status: 'failed',
        generation_error:  "Failed after #{msg['retry_count']} retries"
      )
    end
    Rails.logger.error("[N10] Portfolio generation permanently failed for session #{session_id}")
  end

  def perform(session_id)
    session = Session.find(session_id)
    Portfolios::Generator.new(session: session).call
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N10] Session #{session_id} not found — skipping")
  end
end
