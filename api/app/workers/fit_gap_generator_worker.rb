class FitGapGeneratorWorker
  include Sidekiq::Worker

  GENERATION_LOCK_TIMEOUT = 10 * 60
  SAFE_ERROR_MESSAGE = "Fit/gap generation is temporarily unavailable. Please try again."

  sidekiq_options queue: :default, retry: 2

  def perform(portfolio_id, vacancy_id)
    portfolio = Portfolio.includes(session: :assessment).find(portfolio_id)
    vacancy = Vacancy.unscoped.where(tenant_id: portfolio.session.tenant_id).find(vacancy_id)
    report = find_or_create_report(portfolio, vacancy)
    generation_token = claim_report(report)
    return if generation_token.nil?

    FitGap::Engine.new(
      portfolio:,
      vacancy:,
      report:,
      generation_token:
    ).call
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N13] Fit/gap source record unavailable")
  rescue StandardError => e
    fail_report!(report, generation_token) if report
    Rails.logger.error("[N13] FitGapGeneratorWorker failed: #{e.class}")
    raise
  end

  private

  def find_or_create_report(portfolio, vacancy)
    FitGapReport.find_or_create_by!(portfolio_id: portfolio.id, vacancy_id: vacancy.id) do |report|
      report.skill_comparisons = []
      report.generation_status = "pending"
    end
  end

  def claim_report(report)
    token = nil

    report.with_lock do
      next if report.complete?
      next if report.generating? && report.generation_started_at &&
              report.generation_started_at > Time.current - GENERATION_LOCK_TIMEOUT

      token = SecureRandom.hex(24)
      report.update!(
        generation_status: "generating",
        generation_error: nil,
        generation_started_at: Time.current,
        generation_token: token
      )
    end

    token
  end

  def fail_report!(report, generation_token)
    report.with_lock do
      next unless report.generation_token == generation_token

      report.update(
        generation_status: "failed",
        generation_error: SAFE_ERROR_MESSAGE,
        generation_started_at: nil,
        generation_token: nil
      )
    end
  rescue StandardError
    nil
  end
end
