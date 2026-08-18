# frozen_string_literal: true

class PortfolioGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :portfolio, retry: 3

  sidekiq_retries_exhausted do |msg, _ex|
    session_id = msg['args'].first
    session = Session.unscoped.find_by(id: session_id)
    portfolio = session&.portfolio

    if portfolio&.published_result?
      portfolio.update(
        generation_status: 'complete',
        generation_error:  'Regeneration failed after retries. Preserved previous results.'
      )
    else
      portfolio&.update(
        generation_status: 'failed',
        generation_error:  'Evaluation generation permanently failed.'
      )
    end

    Rails.logger.error("[N10] Portfolio generation permanently failed for session #{session_id}")
  end

  def perform(session_id)
    session = Session.unscoped.find(session_id)
    organization = Organization.find_by(id: session.tenant_id)

    Current.using(tenant_id: session.tenant_id, organization: organization) do
      Portfolios::Generator.new(session: session).call
    end
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N10] Session #{session_id} not found — skipping")
  end
end
