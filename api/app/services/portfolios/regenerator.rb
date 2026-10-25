# frozen_string_literal: true

module Portfolios
  # Re-queues generation for a portfolio that failed or went stale
  # (stuck 'pending'/'generating' for too long). Fresh or complete portfolios
  # are refused so a double click cannot start two generations.
  class Regenerator
    class NotRegenerable < StandardError; end
    class QueueUnavailable < StandardError; end

    def initialize(portfolio)
      @portfolio = portfolio
    end

    def call
      # The row lock makes a second concurrent request wait, then see a fresh
      # 'pending' portfolio and be refused.
      @portfolio.with_lock do
        unless @portfolio.regenerable?
          raise NotRegenerable, "Portfolio is #{@portfolio.generation_status} and not stale; nothing to regenerate"
        end

        @portfolio.update!(generation_status: 'pending', generation_error: nil, status_changed_at: Time.current)
      end

      enqueue!
      @portfolio
    end

    private

    def enqueue!
      PortfolioGeneratorWorker.perform_async(@portfolio.session_id)
    rescue StandardError => e
      Rails.logger.error("[Portfolios::Regenerator] could not enqueue portfolio #{@portfolio.id}: #{e.class}")
      @portfolio.update!(
        generation_status: 'failed',
        generation_error:  Sessions::EndHandler::ENQUEUE_FAILED_MESSAGE
      )
      raise QueueUnavailable, 'The generation queue is unavailable'
    end
  end
end
