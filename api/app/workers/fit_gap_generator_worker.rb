# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  LOCK_TTL_MS = 120_000

  def self.lock_key(portfolio_id, vacancy_id)
    "fitgap_lock:#{portfolio_id}:#{vacancy_id}"
  end

  def self.enqueue_unless_running(portfolio_id, vacancy_id, trigger_reason = 'initial_generation')
    acquired = Sidekiq.redis { |c| c.set(lock_key(portfolio_id, vacancy_id), 1, nx: true, px: LOCK_TTL_MS) }
    return false unless acquired

    perform_async(portfolio_id, vacancy_id, trigger_reason)
    true
  end

  def perform(portfolio_id, vacancy_id, trigger_reason = 'initial_generation')
    portfolio = Portfolio.find(portfolio_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)

    FitGap::Engine.new(
      portfolio:      portfolio,
      vacancy:        vacancy,
      trigger_reason: trigger_reason
    ).call
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
    raise
  ensure
    Sidekiq.redis { |c| c.del(self.class.lock_key(portfolio_id, vacancy_id)) }
  end
end
