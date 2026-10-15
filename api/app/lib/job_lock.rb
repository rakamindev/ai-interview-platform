# frozen_string_literal: true

# Short-lived Redis lock used to avoid enqueueing the same job over and over
# (e.g. a client polling an endpoint that enqueues on every miss).
#
# Fails open: if Redis is unreachable we would rather enqueue a duplicate
# (the jobs themselves are idempotent) than never enqueue at all.
module JobLock
  module_function

  def acquire(key, ttl:)
    result = Sidekiq.redis { |conn| conn.call('SET', namespaced(key), '1', 'NX', 'EX', ttl.to_i) }
    result == 'OK'
  rescue StandardError => e
    Rails.logger.warn("[JobLock] Could not acquire #{key}: #{e.class}")
    true
  end

  def release(key)
    Sidekiq.redis { |conn| conn.call('DEL', namespaced(key)) }
  rescue StandardError => e
    Rails.logger.warn("[JobLock] Could not release #{key}: #{e.class}")
  end

  def namespaced(key)
    "job_lock:#{key}"
  end
end
