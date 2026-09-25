# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  def perform(portfolio_id, vacancy_id)
    portfolio = Portfolio.find(portfolio_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)
    report    = FitGapReport.find_by(portfolio_id: portfolio_id, vacancy_id: vacancy_id)

    # The controller creates a placeholder before enqueueing. Keeping the state
    # in the database makes retries/idempotency observable to the UI.
    report&.update!(generation_status: 'generating', generation_error: nil)

    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue StandardError => e
    FitGapReport.find_by(portfolio_id: portfolio_id, vacancy_id: vacancy_id)&.update(
      generation_status: 'failed',
      generation_error: e.message.to_s.truncate(500)
    )
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
    raise
  end
end
