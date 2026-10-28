# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  def perform(portfolio_id, vacancy_id)
    portfolio = Portfolio.find(portfolio_id)
    # Jobs run without a request tenant, so the default scope is not applied here.
    vacancy   = Vacancy.unscoped.find(vacancy_id)

    unless vacancy.tenant_id == portfolio.session.tenant_id
      Rails.logger.warn("[N13] Skipped fit/gap: tenant mismatch portfolio=#{portfolio_id} vacancy=#{vacancy_id}")
      return
    end

    # Requests claim the report before enqueueing; a job whose report is no
    # longer claimed is a duplicate and exits (AC-50).
    report = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
    if report && report.status != 'generating'
      Rails.logger.info("[N13] Skipped fit/gap: report #{report.id} is #{report.status}")
      return
    end

    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}")
    raise
  end
end
