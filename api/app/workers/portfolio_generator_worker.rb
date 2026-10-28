# frozen_string_literal: true

class PortfolioGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :portfolio, retry: 3

  sidekiq_retries_exhausted do |msg, _ex|
    session_id = msg['args'].first
    session = Session.find_by(id: session_id)
    # error_message is an exception string rendered to assessors: keep the
    # class/structure only and drop anything the model echoed back.
    safe_error = Gemini::Config.safe_message(msg['error_message'].to_s, limit: 200)
    session&.portfolio&.update(
      generation_status: 'failed',
      generation_error:  "Failed after #{msg['retry_count']} retries: #{safe_error}"
    )
    Rails.logger.error("[N10] Portfolio generation permanently failed for session #{session_id}")
  end

  def perform(session_id)
    session = Session.find(session_id)
    Portfolios::Generator.new(session: session).call
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N10] Session #{session_id} not found — skipping")
  end
end
