# frozen_string_literal: true

# Generates only the AI narrative; the comparison table is written synchronously by the request.
# Idempotent: a duplicate job for unchanged inputs is a no-op (see FitGap::Engine#generate_narrative!).
class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  # Engine already converts model errors into a "failed" narrative; this is the safety net for
  # anything else (DB down, etc.) so the UI never waits on a job that will not run again.
  sidekiq_retries_exhausted do |msg, _ex|
    portfolio_id, vacancy_id = msg['args']
    FitGapReport.where(portfolio_id: portfolio_id, vacancy_id: vacancy_id, narrative_status: 'pending')
                .update_all(narrative_status: 'failed', generation_error: 'RetriesExhausted')
    Rails.logger.error("[N13] Fit/gap narrative permanently failed portfolio=#{portfolio_id} vacancy=#{vacancy_id}")
  end

  def perform(portfolio_id, vacancy_id)
    portfolio = Portfolio.find(portfolio_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)

    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).generate_narrative!
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.class}")
  end
end
