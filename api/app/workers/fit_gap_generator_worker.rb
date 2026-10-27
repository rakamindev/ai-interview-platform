# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  def perform(portfolio_id, vacancy_id)
    portfolio = Portfolio.includes(:session).find(portfolio_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)

    #mencegah cross-tenant comparisons between mismatched portfolios and vacancies
    if portfolio.session.tenant_id != vacancy.tenant_id
      raise ActiveRecord::RecordNotFound, "Tenant mismatch between portfolio and vacancy"
    end

    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
    raise
  end
end
