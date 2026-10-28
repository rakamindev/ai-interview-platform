# frozen_string_literal: true

class FitGapGeneratorWorker
  class GenerationInProgress < StandardError; end

  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  sidekiq_retries_exhausted do |job, error|
    portfolio_id, vacancy_id, generation_token = job["args"]
    FitGapReport.where(
      portfolio_id: portfolio_id,
      vacancy_id: vacancy_id,
      generation_token: generation_token,
      generation_status: %w[pending generating]
    )
                .update_all(
                  generation_status: "failed",
                  generation_started_at: nil,
                  generation_token: nil
                )
    Rails.logger.error(
      "[N13] Fit/gap generation exhausted retries for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{error.class}"
    )
  end

  def perform(portfolio_id, vacancy_id, generation_token = nil)
    return if generation_token.blank?

    portfolio = Portfolio.find(portfolio_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)
    session   = Session.unscoped.find(portfolio.session_id)

    unless session.tenant_id == vacancy.tenant_id
      FitGapReport.where(
        portfolio_id: portfolio.id,
        vacancy_id: vacancy.id,
        generation_token: generation_token
      )
                  .where(generation_status: "pending")
                  .update_all(
                    generation_status: "failed",
                    generation_started_at: nil,
                    generation_token: nil
                  )
      Rails.logger.warn("[N13] Refused cross-tenant fit/gap job portfolio=#{portfolio_id} vacancy=#{vacancy_id}")
      return
    end

    claimed_report = FitGapReport.transaction do
      report = FitGapReport.lock.find_by(
        portfolio_id: portfolio.id,
        vacancy_id: vacancy.id,
        generation_token: generation_token
      )
      if report&.generation_status == "pending"
        report.update!(generation_status: "generating", generation_started_at: Time.current)
        report
      elsif report&.generation_status == "generating"
        raise GenerationInProgress, "Fit/gap attempt is already generating"
      end
    end
    return unless claimed_report

    FitGap::Engine.new(
      portfolio: portfolio,
      vacancy: vacancy,
      generation_started_at: claimed_report.generation_started_at,
      generation_token: generation_token
    ).call
  rescue GenerationInProgress
    Rails.logger.info("[N13] Fit/gap attempt is already active portfolio=#{portfolio_id} vacancy=#{vacancy_id}")
    raise
  rescue ActiveRecord::RecordNotFound
    FitGapReport.where(
      portfolio_id: portfolio_id,
      vacancy_id: vacancy_id,
      generation_token: generation_token
    )
                .where(generation_status: %w[pending generating])
                .update_all(
                  generation_status: "failed",
                  generation_started_at: nil,
                  generation_token: nil
                )
    Rails.logger.warn("[N13] Fit/gap records not found portfolio=#{portfolio_id} vacancy=#{vacancy_id}")
  rescue StandardError => e
    FitGapReport.where(
      portfolio_id: portfolio_id,
      vacancy_id: vacancy_id,
      generation_token: generation_token
    )
                .where(generation_status: "generating")
                .update_all(generation_status: "pending", generation_started_at: nil)
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}")
    raise
  end
end
