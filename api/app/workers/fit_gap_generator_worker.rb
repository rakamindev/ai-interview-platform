# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  def perform(portfolio_id, vacancy_id, tenant_id = nil)
    return Rails.logger.warn("[N13] Missing tenant for portfolio #{portfolio_id} — skipping") if tenant_id.blank?

    Current.using(tenant_id:) do
      portfolio = Portfolio.joins(:session).merge(Session.all).find(portfolio_id)
      vacancy   = Vacancy.find(vacancy_id)

      FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
    end
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
    raise
  end
end
