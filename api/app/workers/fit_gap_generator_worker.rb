# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  def perform(portfolio_id, vacancy_id, opts = {})
    Rails.logger.info("[N13] correlation_id=#{Current.correlation_id} portfolio=#{portfolio_id} vacancy=#{vacancy_id}")
    lock_key = Zlib.crc32("fitgap:#{portfolio_id}:#{vacancy_id}")

    acquired = ActiveRecord::Base.connection.select_value(
      ActiveRecord::Base.sanitize_sql_array(["SELECT pg_try_advisory_lock(?)", lock_key])
    )

    unless acquired
      Rails.logger.info("[N13] Advisory lock not acquired for portfolio=#{portfolio_id} vacancy=#{vacancy_id}, skipping")
      return
    end

    begin
      # Workers have no request context (no TenantScoped default_scope),
      # so unscoped is explicit to make the intent clear.
      portfolio = Portfolio.unscoped.find(portfolio_id)
      vacancy   = Vacancy.unscoped.find(vacancy_id)

      FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
    rescue ActiveRecord::RecordNotFound => e
      Rails.logger.warn("[N13] Record not found: #{e.message}")
    rescue StandardError => e
      Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
      send_generation_failure_notification(portfolio_id, e)
      raise
    ensure
      ActiveRecord::Base.connection.execute(
        ActiveRecord::Base.sanitize_sql_array(["SELECT pg_advisory_unlock(?)", lock_key])
      )
    end
  end

  private

  def send_generation_failure_notification(portfolio_id, error)
    portfolio = Portfolio.unscoped.find_by(id: portfolio_id)
    return unless portfolio

    session = portfolio.session
    return unless session

    assessment = session.assessment
    AssessmentMailer.generation_failed(assessment, session, error).deliver_later
  rescue StandardError => e
    Rails.logger.error("[N13] Failed to send failure notification: #{e.message}")
  end
end
