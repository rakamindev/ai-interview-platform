# frozen_string_literal: true

class PortfolioGeneratorWorker
  include Sidekiq::Worker

  # Fail visibly and let the assessor explicitly retry with a new attempt token.
  sidekiq_options queue: :portfolio, retry: false

  def perform(session_id, request_token = nil)
    session = Session.find(session_id)
    portfolio = session.portfolio
    return unless portfolio && request_token.present?

    accepted = false
    portfolio.with_lock do
      if portfolio.generation_attempt_token == request_token &&
         %w[pending complete].include?(portfolio.generation_status)
        portfolio.update!(generation_status: 'generating', generation_attempted_at: Time.current) unless portfolio.complete?
        accepted = true
      end
    end
    return unless accepted

    Portfolios::Generator.new(session: session, request_token: request_token).call
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N10] Session #{session_id} not found — skipping")
  end
end
