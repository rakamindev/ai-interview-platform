# frozen_string_literal: true

module Rack
  class Attack
    # Use Redis for distributed throttle state across pods.
    Rack::Attack.cache.store = ActiveSupport::Cache::RedisCacheStore.new(
      url: ENV.fetch("REDIS_URL", "redis://localhost:6379/1")
    )

    # Throttle login attempts: 5 per minute per IP.
    throttle("auth/login", limit: 5, period: 1.minute) do |req|
      req.ip if req.path == "/api/v1/auth/login" && req.post?
    end

    # Throttle refresh-token use: 20 per minute per IP.
    throttle("auth/refresh", limit: 20, period: 1.minute) do |req|
      req.ip if req.path == "/api/v1/auth/refresh" && req.post?
    end

    # Throttle logout: 20 per minute per IP.
    throttle("auth/logout", limit: 20, period: 1.minute) do |req|
      req.ip if req.path == "/api/v1/auth/logout" && req.delete?
    end

    # Throttle candidate-facing endpoints: 30 per minute per IP.
    throttle("candidate/session", limit: 30, period: 1.minute) do |req|
      req.ip if req.path.match?(%r{\A/api/v1/sessions/[^/]+/(candidate|audio_complete)\z})
    end

    # Throttle fit/gap generation: 5 per minute per IP.
    throttle("portfolios/fitgap", limit: 5, period: 1.minute) do |req|
      req.ip if req.path.match?(%r{\A/api/v1/portfolios/[^/]+/(fitgap|regenerate_fitgap)\z}) && req.post?
    end

    # Throttle assessment creation: 10 per minute per IP.
    throttle("assessments/create", limit: 10, period: 1.minute) do |req|
      req.ip if req.path == "/api/v1/assessments" && req.post?
    end

    # Throttle vacancy creation: 10 per minute per IP.
    throttle("vacancies/create", limit: 10, period: 1.minute) do |req|
      req.ip if req.path == "/api/v1/vacancies" && req.post?
    end

    # Throttle portfolio/fitgap regeneration: 5 per minute per IP.
    throttle("portfolios/regenerate", limit: 5, period: 1.minute) do |req|
      req.ip if req.path.match?(%r{\A/api/v1/sessions/[^/]+/portfolio/regenerate\z}) && req.post?
    end

    # Throttle fitgap regeneration: 5 per minute per IP.
    throttle("fitgap/regenerate", limit: 5, period: 1.minute) do |req|
      req.ip if req.path.match?(%r{\A/api/v1/portfolios/[^/]+/regenerate_fitgap\z}) && req.post?
    end

    # Return 429 JSON instead of the default plain-text response.
    self.throttled_responder = lambda do |_req|
      [
        429,
        { "Content-Type" => "application/json" },
        [{ error: "Too many requests. Please try again later." }.to_json]
      ]
    end
  end
end
