# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  def self.lock_key(portfolio_id, vacancy_id)
    "fitgap:#{portfolio_id}:#{vacancy_id}"
  end

  # Enqueues unless a job for the same pair was enqueued in the last 2 minutes.
  # Returns true when a job was enqueued.
  def self.enqueue_once(portfolio_id, vacancy_id)
    return false unless JobLock.acquire(lock_key(portfolio_id, vacancy_id), ttl: 2.minutes)

    perform_async(portfolio_id, vacancy_id)
    true
  end

  def perform(portfolio_id, vacancy_id)
    portfolio = Portfolio.find(portfolio_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)

    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}")
    raise
  ensure
    JobLock.release(self.class.lock_key(portfolio_id, vacancy_id))
  end
end
