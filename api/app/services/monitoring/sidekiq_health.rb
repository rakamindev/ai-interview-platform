# frozen_string_literal: true

require 'sidekiq/api'

module Monitoring
  # Reports whether background jobs are being processed. Without Sidekiq, portfolios never finish and coverage
  # for running interviews is lost for good, while the API itself looks perfectly healthy.
  #
  # Deliberately separate from /health: that endpoint backs the Kubernetes liveness probe, and restarting the
  # API pod because Sidekiq is down would also cut every live interview.
  class SidekiqHealth
    DEFAULT_MAX_JOB_WAIT = 300 # seconds

    def rack_response
      report = call
      status = report[:status] == 'ok' ? 200 : 503

      [status, { 'Content-Type' => 'application/json' }, [report.to_json]]
    end

    def call
      processes = Sidekiq::ProcessSet.new.size
      queues = Sidekiq::Queue.all.to_h { |queue| [queue.name, queue_report(queue)] }
      reasons = reasons_for(processes, queues)

      { status: reasons.empty? ? 'ok' : 'degraded', reasons: reasons, processes: processes, queues: queues }
    rescue StandardError => e
      Rails.logger.error("[SidekiqHealth] Could not read Sidekiq state: #{e.class}: #{e.message}")
      { status: 'degraded', reasons: ['redis_unavailable'] }
    end

    private

    def queue_report(queue)
      { size: queue.size, oldest_job_age_seconds: queue.latency.round }
    end

    def reasons_for(processes, queues)
      reasons = []
      reasons << 'no_sidekiq_process' if processes.zero?
      reasons << 'job_backlog' if queues.values.any? { |queue| queue[:oldest_job_age_seconds] > max_job_wait }
      reasons
    end

    def max_job_wait
      ENV.fetch('SIDEKIQ_MAX_JOB_WAIT_SECONDS', DEFAULT_MAX_JOB_WAIT).to_i
    end
  end
end
