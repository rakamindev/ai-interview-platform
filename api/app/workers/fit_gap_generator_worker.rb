# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  ENQUEUE_LOCK_TTL = 10.minutes

  def self.enqueue_once(portfolio_id, vacancy_id)
    acquired = Sidekiq.redis do |redis|
      redis.call('SET', lock_key(portfolio_id, vacancy_id), '1', 'NX', 'EX', ENQUEUE_LOCK_TTL.to_i)
    end
    return false unless acquired

    perform_async(portfolio_id, vacancy_id)
    true
  end

  def self.lock_key(portfolio_id, vacancy_id)
    "fitgap:enqueued:#{portfolio_id}:#{vacancy_id}"
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
    Sidekiq.redis { |redis| redis.call('DEL', self.class.lock_key(portfolio_id, vacancy_id)) }
  end
end
