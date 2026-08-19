# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  # REL-3: on permanent failure, mark the pre-created report 'failed' so the
  # client stops polling and can offer retry. update_columns skips validations
  # (and the tenant-scoped belongs_to load) since jobs have no tenant context.
  sidekiq_retries_exhausted do |msg, _ex|
    portfolio_id, vacancy_id = msg['args']
    mark_failed(portfolio_id, vacancy_id, "Failed after #{msg['retry_count']} retries: #{msg['error_message']}")
  end

  # Mark a pre-created report 'failed'. update_columns skips validations (and the
  # tenant-scoped belongs_to load) since jobs run with no tenant context.
  def self.mark_failed(portfolio_id, vacancy_id, error)
    report = FitGapReport.find_by(portfolio_id: portfolio_id, vacancy_id: vacancy_id)
    report&.update_columns(generation_status: 'failed', generation_error: error)
    Rails.logger.error("[N13] Fit/gap generation permanently failed: portfolio=#{portfolio_id} vacancy=#{vacancy_id}")
  end

  def perform(portfolio_id, vacancy_id)
    portfolio = Portfolio.find(portfolio_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)

    Current.using(tenant_id: vacancy.tenant_id) do
      FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
    end
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
    raise
  end
end
