# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker
  sidekiq_options queue: :default, retry: false

  def perform(report_id, token, tenant_id)
    Current.using(tenant_id: tenant_id) do
      report = FitGapReport.find(report_id)
      portfolio = Portfolio.joins(:session).where(sessions: { tenant_id: tenant_id }).find(report.portfolio_id)
      vacancy = Vacancy.where(tenant_id: tenant_id).find(report.vacancy_id)

      portfolio.with_lock do
        report.reload
        return unless report.generation_token == token && report.generation_status == 'pending'
        report.update!(generation_status: 'generating')
        FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
      end
    end
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("Fit/gap ownership or record unavailable report=#{report_id}")
  rescue StandardError => error
    FitGapReport.where(id: report_id, generation_token: token)
      .update_all(generation_status: 'failed', error_code: 'generation_failed')
    Rails.logger.error("Fit/gap generation failed report=#{report_id} error_class=#{error.class}")
  end
end
