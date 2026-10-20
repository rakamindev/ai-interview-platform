# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  def perform(portfolio_id, vacancy_id)
    portfolio = Portfolio.includes(:session).find(portfolio_id)
    tenant_id = portfolio.session.tenant_id
    vacancy   = Vacancy.unscoped.where(tenant_id: tenant_id).find(vacancy_id)

    return unless FitGap::GenerationTracker.acquire_worker_exec_lock(portfolio.id, vacancy.id)

    begin
      FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
      FitGap::GenerationTracker.mark_complete(portfolio.id, vacancy.id)
    ensure
      FitGap::GenerationTracker.release_worker_exec_lock(portfolio.id, vacancy.id)
    end
  rescue ActiveRecord::RecordNotFound => e
    FitGap::GenerationTracker.mark_complete(portfolio_id, vacancy_id)
    Rails.logger.warn("[N13] Record not found or tenant mismatch: #{e.message}")
  rescue StandardError => e
    FitGap::GenerationTracker.mark_failed(portfolio_id, vacancy_id)
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
    raise
  end
end
