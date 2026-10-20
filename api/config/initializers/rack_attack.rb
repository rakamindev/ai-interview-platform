# frozen_string_literal: true

# Throttle counters live on their own Redis instance when REDIS_CACHE_URL is set.
# Required instance policies: the Sidekiq/publisher instance runs
# `maxmemory-policy noeviction`, this instance runs `maxmemory-policy allkeys-lru`
# with an explicit `maxmemory`, so throttle keys can never evict queue entries.
#
# A throttle store outage must not lock everyone out of the application: being
# unable to count requests is not a reason to reject them all.
class FailOpenThrottleStore
  def initialize(store)
    @store = store
  end

  def increment(key, amount = 1, **options)
    guard(__method__, 1, key, amount, **options)
  end

  def write(key, value, **options)
    guard(__method__, nil, key, value, **options)
  end

  def read(key, **options)
    guard(__method__, nil, key, **options)
  end

  def delete(key, **options)
    guard(__method__, nil, key, **options)
  end

  private

  def guard(method_name, fallback, *args, **options)
    begin
      @store.public_send(method_name, *args, options)
    rescue ArgumentError
      # Rails/redis versions differ on whether cache options are positional or
      # keyword arguments. A counter without expiry still fails open safely.
      @store.public_send(method_name, *args)
    end
  rescue StandardError => e
    raise unless store_unavailable?(e)

    Rails.logger.error("[Rack::Attack] throttle store unavailable (#{e.class})")
    fallback
  end
  def store_unavailable?(error)
    %w[Redis RedisClient ActiveSupport::Cache::Store].any? do |prefix|
      error.class.name.to_s.start_with?(prefix)
    end
  end
end

class Rack::Attack
  cache_url = ENV['REDIS_CACHE_URL'].to_s.strip
  cache_url = ENV.fetch('REDIS_URL', 'redis://localhost:6379/1') if cache_url.empty?

  Rack::Attack.cache.store = FailOpenThrottleStore.new(
    ActiveSupport::Cache::RedisCacheStore.new(
      url:             cache_url,
      connect_timeout: 1,
      read_timeout:    1,
      write_timeout:   1
    )
  )

  # Throttle login attempts: 5 per minute per IP.
  throttle('auth/login', limit: 5, period: 1.minute) do |req|
    req.ip if req.path == '/api/v1/auth/login' && req.post?
  end

  # Throttle candidate-facing endpoints: 30 per minute per IP.
  throttle('candidate/session', limit: 30, period: 1.minute) do |req|
    req.ip if req.path.match?(%r{\A/api/v1/sessions/[^/]+/(candidate|audio_complete)\z})
  end

  # Return 429 JSON instead of the default plain-text response.
  self.throttled_responder = lambda do |_req|
    [
      429,
      { 'Content-Type' => 'application/json' },
      [{ error: 'Too many requests. Please try again later.' }.to_json]
    ]
  end
end
