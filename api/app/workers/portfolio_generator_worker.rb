# frozen_string_literal: true

class PortfolioGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :portfolio, retry: 3

  # Same UU PDP rule as Portfolios::Generator#mark_failed: a Sidekiq error message can
  # embed the model response, which quotes the candidate. Persist a short, generic
  # reason instead of the raw message.
  MAX_ERROR_CHARS = 200

  sidekiq_retries_exhausted do |msg, _ex|
    session_id = msg['args'].first
    session = Session.find_by(id: session_id)
    session&.portfolio&.update(
      generation_status: 'failed',
      generation_error:  "Failed after #{msg['retry_count']} retries: #{msg['error_message'].to_s[0, MAX_ERROR_CHARS]}"
    )
    Rails.logger.error("[N10] Portfolio generation permanently failed for session #{session_id}")
  end

  def perform(session_id)
    session = Session.find(session_id)
    # Duplicate enqueues are expected (EndHandler + Sidekiq retry + manual regenerate).
    # Portfolios::Generator claims the row under a lock and returns early instead of
    # racing a run that is already in flight.
    Portfolios::Generator.new(session: session).call
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N10] Session #{session_id} not found — skipping")
  end
end
