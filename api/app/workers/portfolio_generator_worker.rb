# frozen_string_literal: true

class PortfolioGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :portfolio, retry: 3

  sidekiq_retries_exhausted do |msg, _ex|
    session_id = msg['args'].first
    session = Session.unscoped.find_by(id: session_id)
    # The generator already stored a safe error message on the last attempt;
    # msg['error_message'] is raw exception text and may contain model output.
    session&.portfolio&.update(
      generation_status: 'failed',
      generation_error:  session.portfolio.generation_error.presence ||
                         "Failed after #{msg['retry_count']} retries"
    )
    Rails.logger.error("[N10] Portfolio generation permanently failed for session #{session_id}")
  end

  def perform(session_id)
    session = Session.unscoped.find(session_id)
    Portfolios::Generator.new(session: session).call
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N10] Session #{session_id} not found — skipping")
  end
end
