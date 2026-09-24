# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  sidekiq_retries_exhausted do |message, _exception|
    report = FitGapReport.unscoped.find_by(id: message['args'][2])
    report&.update(generation_status: 'failed', generation_error: 'generation_failed')
  end

  def perform(portfolio_id, vacancy_id, generation_token = nil)
    portfolio = Portfolio.unscoped.find(portfolio_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)
    report = FitGapReport.unscoped.find_by!(portfolio_id:, vacancy_id:) if generation_token.present?

    if generation_token.present?
      return unless report.generation_token == generation_token && report.generating?
    end
    raise ActiveRecord::RecordNotFound unless portfolio.session.tenant_id == vacancy.tenant_id

    FitGap::Engine.new(portfolio:, vacancy:, generation_token:).call
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
    raise
  end
end
