# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  def perform(portfolio_id, vacancy_id)
    portfolio = Portfolio.unscoped.includes(:session).find(portfolio_id)
    vacancy   = Vacancy.unscoped.find_by(id: vacancy_id)

    unless vacancy && portfolio.session.tenant_id == vacancy.tenant_id
      Rails.logger.warn(
        "[N13] Skipping fit/gap — tenant mismatch or missing vacancy " \
        "(portfolio=#{portfolio_id} vacancy=#{vacancy_id})"
      )
      return
    end

    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
    raise
  end
end
