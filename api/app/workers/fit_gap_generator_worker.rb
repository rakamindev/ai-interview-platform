# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  LOCK_TTL = 120 # seconds

  def self.lock_key(portfolio_id, vacancy_id)
    "fitgap_generating:#{portfolio_id}:#{vacancy_id}"
  end

  def self.in_progress?(portfolio_id, vacancy_id)
    Sidekiq.redis { |r| r.exists?(lock_key(portfolio_id, vacancy_id)) == 1 }
  rescue StandardError => e
    Rails.logger.warn("[N13] Redis check failed: #{e.message}")
    false
  end

  def self.set_in_progress!(portfolio_id, vacancy_id)
    Sidekiq.redis { |r| r.set(lock_key(portfolio_id, vacancy_id), "1", ex: LOCK_TTL) }
  rescue StandardError => e
    Rails.logger.warn("[N13] Redis set failed: #{e.message}")
  end

  def self.clear_in_progress!(portfolio_id, vacancy_id)
    Sidekiq.redis { |r| r.del(lock_key(portfolio_id, vacancy_id)) }
  rescue StandardError => e
    Rails.logger.warn("[N13] Redis del failed: #{e.message}")
  end

  def perform(portfolio_id, vacancy_id)
    self.class.set_in_progress!(portfolio_id, vacancy_id)

    portfolio = Portfolio.find(portfolio_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)

    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
    raise
  ensure
    self.class.clear_in_progress!(portfolio_id, vacancy_id)
  end
end
