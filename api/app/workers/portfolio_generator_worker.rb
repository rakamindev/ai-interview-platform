# frozen_string_literal: true

class PortfolioGeneratorWorker
  include Sidekiq::Worker

  # Retry dengan backoff lebih panjang untuk handle rate limit (429) dari free tier.
  # Sidekiq default backoff: (retry^4 + 15 + rand(30)) seconds
  # retry: 6 → last attempt ~25 menit setelah failure pertama.
  sidekiq_options queue: :portfolio, retry: 6

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
    Portfolios::Generator.new(session: session).call
  rescue Gemini::HttpClient::RateLimitError => e
    # Re-raise agar Sidekiq retry dengan backoff — jangan mark failed dulu
    Rails.logger.warn("[N10] Rate limited for session #{session_id} — will retry: #{e.message}")
    raise
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N10] Session #{session_id} not found — skipping")
  end
end
