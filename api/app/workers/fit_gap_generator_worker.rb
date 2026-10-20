# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  sidekiq_retries_exhausted do |job, _exception|
    portfolio_id, vacancy_id, token = job['args']
    if token.present?
      FitGapGeneratorWorker.release_lock(
        FitGapGeneratorWorker.lock_key(portfolio_id, vacancy_id), token
      )
    end
  end

  # ponytail: the 30-minute lease covers normal Sidekiq retries; extend it if
  # generation timeouts or retry backoff are increased beyond that window.
  LOCK_TTL = 30.minutes.to_i
  LOCK_KEY = 'fit-gap-generation:%s:%s'
  RELEASE_LOCK_SCRIPT = <<~LUA.freeze
    if redis.call('get', KEYS[1]) == ARGV[1] then
      return redis.call('del', KEYS[1])
    end
    return 0
  LUA

  def self.enqueue_once(portfolio_id, vacancy_id)
    key = lock_key(portfolio_id, vacancy_id)
    token = SecureRandom.hex(16)
    acquired = Sidekiq.redis { |redis| redis.set(key, token, nx: true, ex: LOCK_TTL) }
    return false unless acquired

    return true if perform_async(portfolio_id, vacancy_id, token)

    release_lock(key, token)
    false
  rescue StandardError
    release_lock(key, token) if acquired
    raise
  end

  def self.lock_key(portfolio_id, vacancy_id)
    LOCK_KEY % [portfolio_id, vacancy_id]
  end

  def self.release_lock(key, token)
    Sidekiq.redis { |redis| redis.eval(RELEASE_LOCK_SCRIPT, keys: [key], argv: [token]) }
  end

  def perform(portfolio_id, vacancy_id, token)
    completed = false
    portfolio = Portfolio.find(portfolio_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)

    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
    completed = true
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
    completed = true
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
    raise
  ensure
    if completed && token.present?
      self.class.release_lock(self.class.lock_key(portfolio_id, vacancy_id), token)
    end
  end
end
