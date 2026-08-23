# frozen_string_literal: true

# Sidekiq server middleware that restores the correlation ID into Current
# before the worker runs, so all log output from workers carries the same
# correlation ID as the originating HTTP request or WebSocket session.
#
# The correlation ID is passed inside job args — the enqueue side (client
# middleware) is a no-op; we only inject it when Sidekiq dequeues.
class SidekiqCorrelationMiddleware
  CORRELATION_KEY = "_correlation_id"

  def call(_worker, job, _queue)
    correlation_id = job["args"]&.last.is_a?(Hash) && job["args"].last[CORRELATION_KEY]
    correlation_id ||= job[CORRELATION_KEY]

    Current.correlation_id = correlation_id || SecureRandom.uuid

    yield
  ensure
    Current.clear
  end
end
