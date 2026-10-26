# frozen_string_literal: true

# Generates one fit/gap report. Safe to run more than once for the same pair:
# a row lock + lease ensures only one job computes at a time, and a job whose
# inputs already match a complete report is a no-op.
class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  BUSY_RETRY_DELAY = 30.seconds

  sidekiq_retries_exhausted do |msg, _ex|
    portfolio_id, vacancy_id = msg['args']
    FitGapReport.where(portfolio_id:, vacancy_id:).update_all(
      status: 'failed', error_message: FitGap::ReportPresenter::FAILED_MESSAGE
    )
    Rails.logger.error("[N13] Fit/gap generation permanently failed: portfolio=#{portfolio_id} vacancy=#{vacancy_id}")
  end

  def perform(portfolio_id, vacancy_id)
    report = FitGapReport.find_by(portfolio_id:, vacancy_id:)
    return Rails.logger.warn("[N13] Report gone, skipping: portfolio=#{portfolio_id} vacancy=#{vacancy_id}") unless report

    tenant_id = owning_tenant_id(report)
    return fail!(report, 'This vacancy belongs to a different organization.') unless tenant_id
    return fail!(report, 'The candidate portfolio is not ready yet.') unless report.portfolio.complete?

    # Run as the owning tenant so TenantScoped default scopes apply here too.
    Current.using(tenant_id:) do
      case claim(report)
      when :busy then self.class.perform_in(BUSY_RETRY_DELAY, portfolio_id, vacancy_id)
      when :claimed then FitGap::Engine.new(report:).call
      end
    end
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed: portfolio=#{portfolio_id} vacancy=#{vacancy_id} #{e.class}")
    report&.update_columns(status: 'failed', error_message: FitGap::ReportPresenter::FAILED_MESSAGE)
    raise
  end

  private

  def claim(report)
    report.with_lock do
      if report.generating? && !report.generation_lease_expired?
        :busy
      elsif report.complete? && report.inputs_digest == current_digest(report)
        :up_to_date
      else
        report.update!(status: 'generating', generation_started_at: Time.current, error_message: nil)
        :claimed
      end
    end
  end

  def current_digest(report)
    FitGap::Inputs.new(portfolio: report.portfolio, vacancy: report.vacancy).digest
  end

  # Workers run outside a request, so there is no tenant yet. Derive it from
  # the candidate's session and refuse to mix data across tenants.
  # Returns the tenant id, or nil when portfolio and vacancy disagree.
  def owning_tenant_id(report)
    session = Session.unscoped.find_by(id: report.portfolio.session_id)
    vacancy = Vacancy.unscoped.find_by(id: report.vacancy_id)
    return nil unless session && vacancy && session.tenant_id == vacancy.tenant_id

    session.tenant_id
  end

  def fail!(report, message)
    report.update!(status: 'failed', error_message: message)
    Rails.logger.warn("[N13] Fit/gap not generated (#{message}) report=#{report.id}")
  end
end
