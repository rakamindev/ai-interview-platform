# frozen_string_literal: true

class PortfolioGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :portfolio, retry: 3

  sidekiq_retries_exhausted do |msg, _ex|
    session_id = msg['args'].first
    portfolio  = Session.find_by(id: session_id)&.portfolio

    # Exhausted retries mean this job failed, not that the portfolio is unusable.
    # Another run may have written it already; stamping 'failed' over that hid a
    # complete portfolio behind an error screen.
    next if portfolio.nil? || portfolio.complete?

    portfolio.update(
      generation_status: 'failed',
      generation_error:  "Failed after #{msg['retry_count']} retries: #{msg['error_message']}"
    )
    Rails.logger.error("[N10] Portfolio generation permanently failed for session #{session_id}")
  end

  def perform(session_id)
    session = Session.find(session_id)
    Portfolios::Generator.new(session: session).call
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N10] Session #{session_id} not found — skipping")
  end
end
