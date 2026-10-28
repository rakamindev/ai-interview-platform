# frozen_string_literal: true

module FitGap
  # At most one fit/gap generation per (portfolio, vacancy) at a time, across tabs, users and
  # processes. Taken when a job is enqueued and released by that job when it finishes; the TTL frees
  # it if a worker dies first. The lock holds a token so only the job that took it can release it.
  module GenerationLock
    TTL = 5.minutes

    # Delete the key only if it still holds the caller's token (atomic in Redis).
    RELEASE_SCRIPT = <<~LUA
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      end
      return 0
    LUA

    module_function

    # Returns a token when the lock was free, nil when someone else holds it.
    def acquire(portfolio_id, vacancy_id)
      token = SecureRandom.uuid
      acquired = Sidekiq.redis { |r| r.call('SET', key(portfolio_id, vacancy_id), token, 'NX', 'EX', TTL.to_i) }
      token if acquired == 'OK'
    end

    def release(portfolio_id, vacancy_id, token)
      Sidekiq.redis { |r| r.call('EVAL', RELEASE_SCRIPT, 1, key(portfolio_id, vacancy_id), token) }
    end

    def held?(portfolio_id, vacancy_id)
      Sidekiq.redis { |r| r.call('EXISTS', key(portfolio_id, vacancy_id)) } == 1
    end

    def key(portfolio_id, vacancy_id)
      "fitgap:generating:#{portfolio_id}:#{vacancy_id}"
    end
  end
end
