# frozen_string_literal: true

module Portfolios
  # Creates the next scoring generation for a portfolio and enqueues its job.
  #
  # The generation is persisted (and committed) BEFORE the job is enqueued, and the job carries the
  # generation id. A job can therefore only ever work on the generation it was created for; it can
  # never "become" a newer request by running late (design A1/A2).
  class RequestGeneration
    class InFlight < StandardError
      attr_reader :generation

      def initialize(generation)
        @generation = generation
        super("Generation ##{generation.sequence} is still #{generation.status}")
      end
    end

    # Raised when an assessor's Regenerate is not allowed. `code` is stable for the API and UI.
    class NotAllowed < StandardError
      attr_reader :code

      def initialize(code, message)
        @code = code
        super(message)
      end
    end

    # admin_rescore: reserved for a future administrative re-score workflow (e.g. after a deliberate
    # model change). It is not exposed to assessors.
    SOURCES = %w[session_end assessor_regenerate admin_rescore legacy_job].freeze

    # A pending retry that has not run for this long is treated as lost (scheduled retries can be
    # delayed by queue congestion, so this is a recovery heuristic, not a guarantee). The longest
    # scheduled Sidekiq wait at retry: 6 is about 11.6 minutes.
    STALE_RETRYING_AFTER = 30.minutes

    # Answers "may the assessor press Regenerate now?" without changing anything.
    # Returns nil when allowed, or a NotAllowed describing why not.
    def self.regenerate_blocker(portfolio)
      if portfolio.current_generation_id
        return NotAllowed.new('report_exists',
                              'A report already exists. To disagree with a rating, use Override and explain why.')
      end

      in_flight = portfolio.generations.blocking_new_requests.or(
        portfolio.generations.where(status: 'retrying').where('started_at >= ?', STALE_RETRYING_AFTER.ago)
      ).reorder(:sequence).last
      return InFlight.new(in_flight) if in_flight

      latest = portfolio.latest_generation
      if latest&.status == 'failed' && ProviderError::NEEDS_ADMIN_CODES.include?(latest.error_code) &&
         latest.config_fingerprint == Generator.config_fingerprint
        return NotAllowed.new('needs_admin',
                              "Scoring failed in a way retrying cannot fix (#{latest.error_code}). " \
                              'An administrator must update the scoring configuration first.')
      end

      nil
    end

    def initialize(portfolio:, source:, enqueue: true)
      @portfolio = portfolio
      @source    = source
      @enqueue   = enqueue
    end

    class EnqueueFailed < StandardError
      attr_reader :generation

      def initialize(generation, cause_message)
        @generation = generation
        super("Could not enqueue generation ##{generation.sequence}: #{cause_message}")
      end
    end

    # Returns the created PortfolioGeneration, or nil when a legacy job finds work already exists.
    # Raises InFlight for assessor requests while an earlier generation is still queued or running,
    # and EnqueueFailed when the job could not be handed to Sidekiq.
    def call
      generation = Portfolio.transaction do
        @portfolio.lock! # serialises sequence assignment with other requests and with publication
        # A legacy job may only create the very first generation. The check must happen under the
        # same lock as the insert, or a modern request could slip in between (design A1).
        next nil if @source == 'legacy_job' && @portfolio.generations.exists?

        if @source == 'assessor_regenerate'
          blocker = self.class.regenerate_blocker(@portfolio)
          raise blocker if blocker
        end

        next_sequence = @portfolio.generations.maximum(:sequence).to_i + 1
        created = @portfolio.generations.create!(
          sequence:        next_sequence,
          status:          'queued',
          source:          @source,
          requested_model:    Generator.requested_model,
          prompt_version:     Generator::PROMPT_VERSION,
          config_fingerprint: Generator.config_fingerprint
        )
        sync_portfolio_status!
        created
      end

      enqueue!(generation) if generation && @enqueue
      generation
    end

    private

    # The generation is committed before Redis is touched, so a Redis outage would otherwise leave a
    # "queued" run that no job will ever pick up, blocking every later request. Mark it failed instead
    # so the published result stays put and the assessor can simply try again.
    def enqueue!(generation)
      PortfolioGeneratorWorker.perform_async(@portfolio.session_id, generation.id)
    rescue StandardError => e
      PortfolioGeneration.where(id: generation.id, status: 'queued')
                         .update_all(status: 'failed', error_code: 'enqueue_failed',
                                     error_message: 'Could not start scoring; please try again.',
                                     finished_at: Time.current)
      unless @portfolio.reload.current_generation_id
        @portfolio.update!(generation_status: 'failed', generation_error: 'Could not start scoring; please try again.')
      end
      Rails.logger.error("[N10] enqueue_failed generation=#{generation.id}: #{e.class}: #{e.message}")
      raise EnqueueFailed.new(generation.reload, e.message)
    end

    # Keeps the legacy portfolios.generation_status column meaningful for existing readers: a
    # portfolio with a published generation stays "complete" while a re-score runs.
    def sync_portfolio_status!
      return if @portfolio.current_generation_id

      @portfolio.update!(generation_status: 'pending', generation_error: nil)
    end
  end
end
