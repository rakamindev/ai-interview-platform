# frozen_string_literal: true

class PortfolioGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :portfolio, retry: 3

  sidekiq_retries_exhausted do |msg, _ex|
    session_id = msg['args'].first
    session = Session.unscoped.find_by(id: session_id)
    session&.portfolio&.update(
      generation_status: 'failed',
      generation_error:  "Generation failed after #{msg['retry_count'].to_i + 1} attempts. " \
                         'Use Retry to try again.'
    )
    Rails.logger.error("[N10] Portfolio generation permanently failed for session #{session_id}")
  end

  # Safe to enqueue more than once: Generator claims the portfolio under a row
  # lock and returns without calling the model if another run owns it or it is
  # already complete.
  def perform(session_id)
    session = Session.unscoped.find(session_id)
    Portfolios::Generator.new(session: session).call
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N10] Session #{session_id} not found — skipping")
  end
end
