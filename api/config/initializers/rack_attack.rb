# frozen_string_literal: true

class Rack::Attack
  # Use Redis for distributed throttle state across pods.
  Rack::Attack.cache.store = ActiveSupport::Cache::RedisCacheStore.new(
    url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1')
  )

  # Throttle login attempts: 5 per minute per IP.
  throttle('auth/login', limit: 5, period: 1.minute) do |req|
    req.ip if req.path == '/api/v1/auth/login' && req.post?
  end

  # Public administrator onboarding endpoints accept bearer-like invitation
  # tokens. Bound retries by IP without exposing whether a supplied token was
  # valid, expired, revoked, or already used.
  throttle('auth/admin-invitation', limit: 10, period: 1.minute) do |req|
    next unless req.post?

    req.ip if [
      '/api/v1/auth/signup',
      '/api/v1/auth/admin_invitations/validate'
    ].include?(req.path)
  end

  # Throttle candidate-facing endpoints: 30 per minute per IP.
  throttle('candidate/session', limit: 30, period: 1.minute) do |req|
    req.ip if req.path.match?(%r{\A/api/v1/sessions/[^/]+/(candidate|audio_complete)\z})
  end

  # Return 429 JSON in the unified error envelope instead of the default plain-text response.
  self.throttled_responder = lambda do |_req|
    [
      429,
      { 'Content-Type' => 'application/json' },
      [ErrorEnvelope.payload(message: 'Too many requests. Please try again later.', status: 429).to_json]
    ]
  end
end
