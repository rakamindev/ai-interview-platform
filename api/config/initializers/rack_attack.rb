# frozen_string_literal: true

class Rack::Attack
  # Use Redis for distributed throttle state across pods.
  redis_url = ENV.fetch('REDIS_URI', 'redis://localhost:6379/0')
  Rack::Attack.cache.store = ActiveSupport::Cache::RedisCacheStore.new(
    url: redis_url
  )

  # Throttle login attempts: 5 per minute per IP.
  throttle('auth/login', limit: 5, period: 1.minute) do |req|
    req.ip if req.path == '/api/v1/auth/login' && req.post?
  end

  # Throttle candidate-facing endpoints: 30 per minute per IP.
  throttle('candidate/session', limit: 30, period: 1.minute) do |req|
    req.ip if req.path.match?(%r{\A/api/v1/sessions/[^/]+/(candidate|audio_complete)\z})
  end

  # Throttle the pre-check probe. One run is 4 counted requests, and candidates
  # behind a shared campus/office/carrier NAT start together, so the limit is
  # generous; with downloads capped at 256 KB it still bounds an IP to ~30 MB/min.
  # The pattern also catches the `.json` format suffix and trailing slashes,
  # both of which Rails routes to the same action.
  throttle('candidate/speed_test', limit: 120, period: 1.minute) do |req|
    req.ip if req.path.match?(%r{\A/api/v1/speed_test(\.\w+)?/*\z})
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
