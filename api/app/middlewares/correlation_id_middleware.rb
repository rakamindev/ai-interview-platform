# frozen_string_literal: true

# Rack middleware that generates a UUID correlation ID per request and stores
# it in Current (RequestStore) so every downstream component can thread it
# through logs, Sidekiq jobs, and external API calls.
class CorrelationIdMiddleware
  HEADER_KEY = "X-Correlation-Id"

  def initialize(app)
    @app = app
  end

  def call(env)
    correlation_id = env["HTTP_X_CORRELATION_ID"].presence || SecureRandom.uuid

    Current.correlation_id = correlation_id

    status, headers, body = @app.call(env)

    headers[HEADER_KEY] = correlation_id

    [status, headers, body]
  ensure
    Current.clear
  end
end
