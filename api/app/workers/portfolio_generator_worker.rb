# frozen_string_literal: true

class PortfolioGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :portfolio, retry: 3

  sidekiq_retries_exhausted do |msg, _ex|
    session_id = msg['args'].first
    session = Session.find_by(id: session_id)
    portfolio = session&.portfolio
    portfolio&.update(
      generation_status: 'failed',
      generation_error:  'Portfolio processing failed after retries. Please contact the assessor.'
    ) unless portfolio&.complete?
    Rails.logger.error("[N10] Portfolio generation permanently failed for session #{session_id}")
  end

  def perform(session_id)
    session = Session.find(session_id)
    Portfolios::Generator.new(session: session).call
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N10] Session #{session_id} not found — skipping")
  rescue StandardError => error
    Rails.logger.error("[N10] Portfolio processing failed session=#{session_id} error_class=#{error.class}")
    raise StandardError, 'Portfolio processing failed', cause: nil
  end
end
