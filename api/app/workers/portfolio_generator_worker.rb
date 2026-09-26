# frozen_string_literal: true

class PortfolioGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :portfolio, retry: 3

  # Every try failed. The report keeps the kind of the last failure, unless
  # another run has finished it in the meantime.
  sidekiq_retries_exhausted do |msg, _ex|
    session_id = msg['args'].first
    portfolio = Session.find_by(id: session_id)&.portfolio
    if portfolio && !portfolio.complete?
      portfolio.fail!(portfolio.failure_kind,
                      "Failed after #{msg['retry_count']} retries: #{msg['error_message']}")
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
