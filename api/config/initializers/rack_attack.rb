class Rack::Attack
  # Use Redis for distributed throttle state when available;
  # fall back to MemoryStore gracefully so login never crashes with TCP reset when Redis is offline.
  Rack::Attack.cache.store = begin
    redis_url = ENV.fetch('REDIS_URL', 'redis://localhost:6379/1')
    if (Rails.env.production? || Rails.env.staging?) && ENV['REDIS_URL'].present?
      ActiveSupport::Cache::RedisCacheStore.new(
        url: redis_url,
        error_handler: ->(method:, returning:, exception:) {
          Rails.logger.warn("[Rack::Attack] Redis cache error: #{exception.message}")
        }
      )
    else
      # In development/test, probe Redis; if unreachable, fall back to in-memory store
      begin
        store = ActiveSupport::Cache::RedisCacheStore.new(
          url: redis_url,
          error_handler: ->(method:, returning:, exception:) {
            Rails.logger.warn("[Rack::Attack] Redis cache error: #{exception.message}")
          }
        )
        # Fast non-blocking check
        store.write('rack_attack:ping', '1', expires_in: 1.second)
        store
      rescue StandardError => e
        Rails.logger.info("[Rack::Attack] Redis offline (#{e.message}) — using in-memory store for development")
        ActiveSupport::Cache::MemoryStore.new
      end
    end
  rescue StandardError => e
    Rails.logger.warn("[Rack::Attack] Redis initialization error (#{e.message}) — using in-memory store")
    ActiveSupport::Cache::MemoryStore.new
  end

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
