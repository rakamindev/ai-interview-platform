# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  sidekiq_retries_exhausted do |msg, _error|
    report_id = msg['args'][3]
    FitGapReport.find_by(id: report_id)&.update(
      generation_status: 'failed',
      generation_error: 'The report could not be generated. Review the portfolio and try again.'
    )
  end

  def perform(portfolio_id, vacancy_id, tenant_id, report_id)
    portfolio = Portfolio.for_tenant(tenant_id).find(portfolio_id)
    vacancy = Vacancy.unscoped.find_by!(id: vacancy_id, tenant_id: tenant_id)
    report = FitGapReport.find_by!(
      id: report_id,
      portfolio_id: portfolio.id,
      vacancy_id: vacancy.id
    )

    report.update!(generation_status: 'generating', generation_error: nil)

    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N13] Tenant-scoped fit/gap input not found")
  rescue StandardError => e
    report&.update(
      generation_status: 'failed',
      generation_error: 'The report could not be generated. Review the portfolio and try again.'
    )
    Rails.logger.error("[N13] FitGapGeneratorWorker failed: #{e.class}")
    raise
  end
end
