# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  # lock_token: set when this job took the generation lock; refreshes queued after an override may
  # run without one and must not release a lock another job holds. Jobs queued before tokens existed
  # have two arguments.
  def perform(portfolio_id, vacancy_id, lock_token = nil)
    portfolio = Portfolio.find(portfolio_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)

    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
    raise
  ensure
    FitGap::GenerationLock.release(portfolio_id, vacancy_id, lock_token) if lock_token
  end
end
