# frozen_string_literal: true

module Portfolios
  class GenerationManager
    class EnqueueError < StandardError; end

    QUEUED_TIMEOUT = 2.minutes
    RUNNING_TIMEOUT = 5.minutes

    def initialize(portfolio)
      @portfolio = portfolio
    end

    def queue
      token = SecureRandom.hex(24)
      @portfolio.with_lock do
        @portfolio.update!(generation_attempt_token: token,
                           generation_attempted_at: Time.current,
                           generation_status: @portfolio.complete? ? 'complete' : 'pending',
                           generation_error: nil)
      end

      job_id = PortfolioGeneratorWorker.perform_async(@portfolio.session_id, token)
      raise EnqueueError, 'No job ID returned' if job_id.blank?

      job_id
    rescue StandardError => e
      @portfolio.with_lock do
        if @portfolio.generation_attempt_token == token
          @portfolio.update!(generation_attempt_token: nil,
                             generation_status: @portfolio.complete? ? 'complete' : 'failed',
                             generation_error: 'EnqueueFailed')
        end
      end
      Rails.logger.error("[Portfolio] Enqueue failed for session #{@portfolio.session_id}: #{e.class}")
      raise EnqueueError, 'Could not queue portfolio generation'
    end

    def expire_stalled!
      @portfolio.with_lock do
        next unless %w[pending generating complete].include?(@portfolio.generation_status)
        next if @portfolio.complete? && @portfolio.generation_attempt_token.nil?

        timeout = @portfolio.generation_status == 'pending' ? QUEUED_TIMEOUT : RUNNING_TIMEOUT
        started = @portfolio.generation_attempted_at
        next if started && started >= Time.current - timeout

        @portfolio.update!(generation_status: @portfolio.complete? ? 'complete' : 'failed',
                           generation_error: 'GenerationTimedOut',
                           generation_attempt_token: nil)
      end
      @portfolio
    end
  end
end
