# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  sidekiq_retries_exhausted do |job, _exception|
    portfolio_id, vacancy_id, requested_fingerprint = job['args']
    mark_failed(portfolio_id, vacancy_id, requested_fingerprint)
  end

  def self.mark_failed(portfolio_id, vacancy_id, requested_fingerprint)
    portfolio = Portfolio.unscoped.find_by(id: portfolio_id)
    return unless portfolio

    Current.using(tenant_id: portfolio.tenant_id) do
      report = FitGapReport.find_by(portfolio_id:, vacancy_id:)
      return unless report

      report.with_lock do
        next unless report.generating? && report.requested_fingerprint == requested_fingerprint

        report.update!(
          generation_status: 'failed',
          generation_error: 'Report regeneration failed. Please try again.'
        )
      end
    end
  end

  def perform(portfolio_id, vacancy_id, requested_fingerprint)
    portfolio = Portfolio.unscoped.find(portfolio_id)
    vacancy = Vacancy.unscoped.find_by!(id: vacancy_id, tenant_id: portfolio.tenant_id)

    Current.using(tenant_id: portfolio.tenant_id) do
      report = FitGapReport.find_by!(portfolio_id:, vacancy_id:)
      return unless report.generating?

      if report.requested_fingerprint != requested_fingerprint
        self.class.perform_async(portfolio_id, vacancy_id, report.requested_fingerprint)
        return
      end

      snapshot = FitGap::SourceFingerprint.call(portfolio:, vacancy:)
      if snapshot.fingerprint != requested_fingerprint
        report.with_lock { report.update!(requested_fingerprint: snapshot.fingerprint) }
        self.class.perform_async(portfolio_id, vacancy_id, snapshot.fingerprint)
        return
      end

      attributes = FitGap::Engine.new(snapshot:).generate
      current_snapshot = FitGap::SourceFingerprint.call(portfolio: portfolio.reload, vacancy: vacancy.reload)
      reconcile = false

      report.with_lock do
        if report.requested_fingerprint == requested_fingerprint && current_snapshot.fingerprint == requested_fingerprint
          report.update!(
            **attributes,
            source_fingerprint: requested_fingerprint,
            generation_status: 'complete',
            generation_error: nil,
            generated_at: Time.current
          )
        else
          report.update!(
            **attributes,
            source_fingerprint: requested_fingerprint,
            requested_fingerprint: current_snapshot.fingerprint,
            generation_status: 'generating',
            generation_error: nil,
            generated_at: Time.current
          )
          reconcile = true
        end
      end

      self.class.perform_async(portfolio_id, vacancy_id, current_snapshot.fingerprint) if reconcile
      Rails.logger.info("[N13] Fit/gap report generated: portfolio=#{portfolio_id} vacancy=#{vacancy_id}")
    end
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
    raise
  end
end
