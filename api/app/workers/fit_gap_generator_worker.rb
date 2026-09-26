# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  # Without this the job dies silently in Sidekiq's dead set and the UI polls a
  # 404 forever. Only the error class is stored — the message can echo request
  # details from the model API.
  sidekiq_retries_exhausted do |msg, ex|
    portfolio_id, vacancy_id = msg["args"]
    portfolio = Portfolio.find_by(id: portfolio_id)
    next unless portfolio

    report = FitGapReport.find_or_initialize_by(portfolio_id: portfolio_id, vacancy_id: vacancy_id)
    report.update!(
      status:            "failed",
      error:             "Generation failed (#{ex.class.name})",
      skill_comparisons: report.skill_comparisons || []
    )
    Rails.logger.error("[N13] Fit/gap permanently failed: portfolio=#{portfolio_id} vacancy=#{vacancy_id}")
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
