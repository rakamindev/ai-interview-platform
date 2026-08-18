# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  # Mark the report as failed (not generating) once retries are exhausted so the
  # controller can surface it and the UI can offer regeneration.
  sidekiq_retries_exhausted do |msg, _ex|
    portfolio_id = msg['args'].first
    vacancy_id   = msg['args'].second
    report = FitGapReport.find_by(portfolio_id: portfolio_id, vacancy_id: vacancy_id)
    report&.update!(
      generation_status: 'failed',
      generation_error:  "Failed after #{msg['retry_count']} retries: #{msg['error_message']}"
    )
    Rails.logger.error("[N13] Fit/gap generation permanently failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}")
  end

  def perform(portfolio_id, vacancy_id)
    portfolio = Portfolio.find(portfolio_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)

    # In-flight marker set by the controller; idempotent re-runs (override regen)
    # just overwrite the same row rather than stacking duplicate reports.
    report = FitGapReport.find_or_initialize_by(portfolio_id: portfolio_id, vacancy_id: vacancy_id)
    report.update!(generation_status: 'generating', generation_error: nil, skill_comparisons: report.skill_comparisons || [])

    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
    raise
  end
end