# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  # Without this the report stays 'generating' forever and the page spins with no way out.
  # The message is generic on purpose: the raw error can echo candidate data (UU PDP).
  sidekiq_retries_exhausted do |msg, _ex|
    portfolio_id, vacancy_id = msg['args']
    FitGapReport.where(portfolio_id: portfolio_id, vacancy_id: vacancy_id)
                .update_all(status: 'failed', error_message: 'Report generation failed. Please try again.')
    Rails.logger.error("[N13] Fit/gap generation permanently failed: portfolio=#{portfolio_id} vacancy=#{vacancy_id}")
  end

  def perform(portfolio_id, vacancy_id)
    portfolio = Portfolio.find(portfolio_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)

    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
    raise
  end
end
