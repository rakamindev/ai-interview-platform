# frozen_string_literal: true

class PortfolioGeneratorWorker
  include Sidekiq::Worker

  # Rate-limit exhaustion is a finished outcome inside Portfolios::Generator
  # (failed status, no re-raise). Keep a small retry budget for transient DB/network
  # faults only — do not treat Gemini 429 as a Sidekiq retry signal.
  sidekiq_options queue: :portfolio, retry: 1

  sidekiq_retries_exhausted do |msg, _ex|
    session_id = msg['args'].first
    session = Session.find_by(id: session_id)
    session&.portfolio&.update(
      generation_status: 'failed',
      generation_error:  'generation_failed'
    )
    Rails.logger.error("[N10] Portfolio generation permanently failed for session #{session_id}")
  end

  def perform(session_id)
    session = Session.find(session_id)
    portfolio = session.portfolio

    if portfolio&.generating?
      Rails.logger.warn("[N10] Portfolio already generating for session #{session_id} — skipping")
      return
    end

    Portfolios::Generator.new(session: session).call
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N10] Session #{session_id} not found — skipping")
  end
end
