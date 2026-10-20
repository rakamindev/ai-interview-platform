# frozen_string_literal: true

module FitGap
  # Coordinates Fit/Gap report generation state, deduplicates concurrent generation
  # requests, and tracks staleness after assessor overrides.
  class GenerationTracker
    LOCK_TTL_SECONDS   = 90
    EXEC_TTL_SECONDS   = 60
    STATE_TTL_SECONDS  = 300
    KEY_PREFIX         = 'ai_interview:fitgap'

    class << self
      def report_stale?(portfolio, report)
        return false if report.nil? || report.generated_at.nil?

        latest_override_at = portfolio.assessor_overrides.maximum(:overridden_at)
        latest_override_at.present? && report.generated_at < latest_override_at
      end

      # Atomically acquires an enqueue lock and schedules FitGapGeneratorWorker
      # if not already queued/running. Returns true if a new job was enqueued.
      def try_lock_and_enqueue(portfolio_id, vacancy_id)
        acquired = redis.set(lock_key(portfolio_id, vacancy_id), Time.current.iso8601, nx: true, ex: LOCK_TTL_SECONDS)
        return false unless acquired

        write_state(portfolio_id, vacancy_id, status: 'generating')
        FitGapGeneratorWorker.perform_async(portfolio_id, vacancy_id)
        true
      end

      # Used for explicit regeneration or post-override invalidation.
      def force_regenerate(portfolio_id, vacancy_id)
        FitGapReport.find_by(portfolio_id: portfolio_id, vacancy_id: vacancy_id)&.destroy
        redis.set(lock_key(portfolio_id, vacancy_id), Time.current.iso8601, ex: LOCK_TTL_SECONDS)
        write_state(portfolio_id, vacancy_id, status: 'generating')
        FitGapGeneratorWorker.perform_async(portfolio_id, vacancy_id)
      end

      # Guards worker execution against duplicate concurrent jobs.
      def acquire_worker_exec_lock(portfolio_id, vacancy_id)
        Boolean(redis.set(exec_key(portfolio_id, vacancy_id), '1', nx: true, ex: EXEC_TTL_SECONDS))
      end

      def release_worker_exec_lock(portfolio_id, vacancy_id)
        redis.del(exec_key(portfolio_id, vacancy_id))
      end

      def mark_complete(portfolio_id, vacancy_id)
        redis.del(
          lock_key(portfolio_id, vacancy_id),
          exec_key(portfolio_id, vacancy_id),
          state_key(portfolio_id, vacancy_id)
        )
      end

      def mark_failed(portfolio_id, vacancy_id, error_code: 'generation_failed')
        redis.del(lock_key(portfolio_id, vacancy_id), exec_key(portfolio_id, vacancy_id))
        write_state(
          portfolio_id,
          vacancy_id,
          status:     'failed',
          error_code: error_code,
          message:    'Unable to generate fit/gap report due to an upstream service error. Please try again.'
        )
      end

      def current_state(portfolio_id, vacancy_id)
        raw = redis.get(state_key(portfolio_id, vacancy_id))
        if raw.present?
          parsed = JSON.parse(raw)
          return parsed if parsed['status'] != 'generating' || locked?(portfolio_id, vacancy_id)
        end

        return { 'status' => 'generating' } if locked?(portfolio_id, vacancy_id)

        nil
      rescue JSON::ParserError
        nil
      end

      def locked?(portfolio_id, vacancy_id)
        redis.exists?(lock_key(portfolio_id, vacancy_id)) ||
          redis.exists?(exec_key(portfolio_id, vacancy_id))
      end

      def reset_test_state!
        keys = redis.keys("#{KEY_PREFIX}:*")
        redis.del(*keys) if keys.any?
      end

      private

      def Boolean(val) # rubocop:disable Naming/MethodName
        val ? true : false
      end

      def write_state(portfolio_id, vacancy_id, payload)
        redis.set(
          state_key(portfolio_id, vacancy_id),
          payload.merge(updated_at: Time.current.iso8601).to_json,
          ex: STATE_TTL_SECONDS
        )
      end

      def lock_key(portfolio_id, vacancy_id)
        "#{KEY_PREFIX}:lock:#{portfolio_id}:#{vacancy_id}"
      end

      def exec_key(portfolio_id, vacancy_id)
        "#{KEY_PREFIX}:exec:#{portfolio_id}:#{vacancy_id}"
      end

      def state_key(portfolio_id, vacancy_id)
        "#{KEY_PREFIX}:state:#{portfolio_id}:#{vacancy_id}"
      end

      def redis
        @redis ||= Redis.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'))
      end
    end
  end
end
