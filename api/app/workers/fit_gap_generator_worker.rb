# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  def perform(portfolio_id, vacancy_id)
    portfolio = Portfolio.unscoped.find(portfolio_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)

    Current.using(tenant_id: portfolio.tenant_id) do
      FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
    end
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
    raise
  end
end
