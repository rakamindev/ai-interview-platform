# frozen_string_literal: true

require "time"

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  sidekiq_retries_exhausted do |message, _exception|
    portfolio_id, vacancy_id, lease_token = message["args"]
    report = FitGapReport.find_by(portfolio_id: portfolio_id, vacancy_id: vacancy_id)

    if report
      report.with_lock do
        current = report.generation_started_at&.utc&.iso8601(6)
        if lease_token.present? && current == lease_token && report.generation_status != "complete"
          report.update!(
            generation_status: "failed",
            generation_error: "Report generation failed after retry attempts",
            generation_started_at: nil
          )
        end
      end
    end

    Rails.logger.error("[N13] Fit/gap generation exhausted retries")
  rescue StandardError => e
    Rails.logger.error("[N13] Could not persist exhausted job state: #{e.class}")
  end

  def perform(portfolio_id, vacancy_id, lease_token = nil)
    portfolio = Portfolio.find(portfolio_id)
    vacancy = Vacancy.unscoped.find(vacancy_id)

    # Jobs queued before the lifecycle migration do not carry a lease token.
    # Hand them off to the current scheduler rather than silently dropping work.
    unless lease_token.is_a?(String) && lease_token.present?
      FitGap::ReportScheduler.enqueue(portfolio: portfolio, vacancy: vacancy)
      Rails.logger.info("[N13] Rescheduled legacy fit/gap job through report lifecycle")
      return
    end
    report = FitGapReport.find_by!(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
    claimed_at = Time.iso8601(lease_token).utc
    claimed = false

    unless portfolio.session.tenant_id == vacancy.tenant_id
      fail_current_lease(report, lease_token, "Report inputs are not available", retryable: false)
      Rails.logger.warn("[N13] Refused cross-tenant report generation")
      return
    end

    report.with_lock do
      current = report.generation_started_at&.utc&.iso8601(6)
      if report.generation_status == "queued" && current == claimed_at.iso8601(6)
        # Keep the lease timestamp stable across retries and through the engine.
        report.update!(generation_status: "generating", generation_error: nil)
        claimed = true
      end
    end
    return unless claimed

    FitGap::Engine.new(
      portfolio: portfolio,
      vacancy: vacancy,
      generation_started_at: claimed_at
    ).call
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N13] Fit/gap job skipped because an input record was unavailable")
  rescue StandardError => e
    fail_current_lease(report, lease_token, "Report generation failed. Please retry.") if report && lease_token
    Rails.logger.error("[N13] Fit/gap generation failed: #{e.class}")
    raise
  end

  private

  def fail_current_lease(report, lease_token, message, retryable: true)
    report.with_lock do
      current = report.generation_started_at&.utc&.iso8601(6)
      if current == lease_token && report.generation_status != "complete"
        # Re-queue under the same lease so Sidekiq's retry can safely claim it.
        report.update!(generation_status: retryable ? "queued" : "failed", generation_error: message, generation_started_at: retryable ? report.generation_started_at : nil)
      end
    end
  rescue StandardError => e
    Rails.logger.error("[N13] Could not persist retry state: #{e.class}")
  end
end
