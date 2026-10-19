# frozen_string_literal: true

class PortfolioGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :portfolio, retry: 3

  sidekiq_retries_exhausted do |msg, _ex|
    session_id = msg['args'].first
    session = Session.find_by(id: session_id)
    session&.portfolio&.update(
      generation_status: 'failed',
      generation_error:  "Failed after #{msg['retry_count']} retries"
    )
    Rails.logger.error("[N10] Portfolio generation permanently failed for session #{session_id}")
  end

  def perform(session_id)
    session = Session.find(session_id)
    portfolio = session.portfolio || session.create_portfolio!(
      candidate_id: session.candidate_id,
      generation_status: 'pending'
    )

    portfolio.with_lock do
      if Portfolios::GenerationGuard.skip?(status: portfolio.generation_status, started_at: portfolio.generation_started_at)
        Rails.logger.info("[N10] Skip duplicate generation for session #{session_id}")
        return
      end

      attributes = { generation_status: 'generating', generation_error: nil }
      attributes[:generation_started_at] = Time.current if portfolio.has_attribute?(:generation_started_at)
      portfolio.update!(attributes)
    end

    Portfolios::Generator.new(session: session).call
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N10] Session #{session_id} not found — skipping")
  end
end
