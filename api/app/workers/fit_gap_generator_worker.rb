# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  def perform(portfolio_id, vacancy_id)
    portfolio = Portfolio.find(portfolio_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)

    run_engine(portfolio, vacancy)
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.class}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}")
    raise
  end

  private

  # Two jobs for the same pair (e.g. one queued by an override, one by opening
  # the report) can both try to insert the row. The result is deterministic,
  # so the job that loses the unique-index race simply updates the other's row.
  def run_engine(portfolio, vacancy)
    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
  rescue ActiveRecord::RecordNotUnique
    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
  end
end
