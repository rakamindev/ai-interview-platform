# frozen_string_literal: true

class Rack::Attack
  # Use Redis for distributed throttle state across pods.
  # In-memory in test so throttle specs don't need a live Redis.
  Rack::Attack.cache.store =
    if Rails.env.test?
      ActiveSupport::Cache::MemoryStore.new
    else
      ActiveSupport::Cache::RedisCacheStore.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'))
    end

  # Rack::Attack sees a raw Rack::Request, which does not parse JSON bodies (what the
  # web app sends), so read the email from the body ourselves. Capped to stay cheap.
  def self.login_email(req)
    return unless req.path == '/api/v1/auth/login' && req.post?

    email = req.params['email']
    if email.blank?
      raw = req.body.read(4096).to_s
      req.body.rewind
      email = (JSON.parse(raw)['email'] rescue nil)
    end
    email.to_s.strip.downcase.presence
  end

  # Throttle login attempts: 5 per minute per IP.
  throttle('auth/login', limit: 5, period: 1.minute) do |req|
    req.ip if req.path == '/api/v1/auth/login' && req.post?
  end

  # Per-account limit: an attacker rotating IPs against one account is invisible to the
  # per-IP rule above. 10 tries / 15 min per email.
  throttle('auth/login/email', limit: 10, period: 15.minutes) { |req| login_email(req) }

  # Throttle candidate-facing endpoints: 30 per minute per IP.
  throttle('candidate/session', limit: 30, period: 1.minute) do |req|
    req.ip if req.path.match?(%r{\A/api/v1/sessions/[^/]+/(candidate|audio_complete)\z})
  end

  # Throttle the hardware-check speed test: 20 per minute per IP. Unauthenticated
  # and pre-session, so it needs its own limit rather than riding on candidate/session.
  throttle('candidate/speed_test', limit: 20, period: 1.minute) do |req|
    req.ip if req.path.match?(%r{\A/api/v1/speed_test})
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
