# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 0

  def perform(portfolio_id, vacancy_id)
    portfolio = Portfolio.find(portfolio_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)

    # Atomic claim: only pending/retryable reports are processed. A duplicate
    # worker (e.g. triggered twice) finds a 'generating'/'complete' report and
    # exits without another model call.
    report = FitGapReport.find_or_initialize_by(
      portfolio_id: portfolio.id,
      vacancy_id:   vacancy.id
    )
    if report.persisted? && !%w[pending failed].include?(report.generation_status)
      Rails.logger.info("[N13] Fit/gap already in progress/completed for portfolio=#{portfolio.id} vacancy=#{vacancy.id} — skipping duplicate")
      return
    end

    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue FitGap::Engine::NarrativeGenerationError => e
    # Deterministic comparisons are already persisted as 'generating'. Mark
    # failed so the UI shows a retry action without losing the comparisons.
    FitGapReport.where(portfolio_id: portfolio_id, vacancy_id: vacancy_id)
                .update_all(
                  generation_status: 'failed',
                  generation_error:  "Narrative generation failed: #{e.message[0, 500]}",
                  generated_at:      Time.current
                )
    Rails.logger.error("[N13] Fit/gap narrative failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
    raise
  end
end
