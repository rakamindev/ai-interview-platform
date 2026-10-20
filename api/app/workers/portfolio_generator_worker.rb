# frozen_string_literal: true

class PortfolioGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :portfolio, retry: 3

  sidekiq_retries_exhausted do |msg, _ex|
    session_id = msg['args'].first
    portfolio  = Session.find_by(id: session_id)&.portfolio
    # msg['error_message'] can quote the model's answer, so only the category's safe message is stored (AC-10).
    portfolio&.update(
      generation_status: 'failed',
      generation_error:  "#{Portfolio.generation_error_message(portfolio.generation_error_category)} "                          "Gave up after #{msg['retry_count']} retries."
    )
    Rails.logger.error("[N10] Portfolio generation permanently failed for session #{session_id}")
  end

  def perform(session_id)
    session = Session.find(session_id)
    # Sidekiq retries a failed attempt, so the portfolio stays "generating" until the hook above gives up (P2-26).
    Portfolios::Generator.new(session: session, mark_failed: false).call
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N10] Session #{session_id} not found — skipping")
  end
end
