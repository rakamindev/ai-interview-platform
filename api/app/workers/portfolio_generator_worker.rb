# frozen_string_literal: true

class PortfolioGeneratorWorker
  include Sidekiq::Worker

  # 6 retries: about 18-21 minutes of scheduled waiting in total (Sidekiq 7.3 backoff:
  # count**4 + 15s + jitter), enough to ride out most short provider outages.
  sidekiq_options queue: :portfolio, retry: 6

  sidekiq_retries_exhausted do |msg, _ex|
    session_id, generation_id = msg['args']
    generation = generation_id && PortfolioGeneration.find_by(id: generation_id)
    if generation
      Portfolios::Generator.mark_exhausted!(
        generation, "Failed after #{msg['retry_count']} retries: #{msg['error_message']}"
      )
    end
    Rails.logger.error("[N10] Portfolio generation permanently failed for session #{session_id} generation #{generation_id}")
  end

  # New jobs always carry the generation they were created for (see Portfolios::RequestGeneration).
  # Jobs enqueued before generations existed carry only the session id; see #legacy_generation.
  def perform(session_id, generation_id = nil)
    generation = generation_id ? PortfolioGeneration.find_by(id: generation_id) : legacy_generation(session_id)
    return Rails.logger.warn("[N10] No generation to run for session #{session_id} (#{generation_id.inspect})") unless generation

    Portfolios::Generator.new(generation: generation).call
  end

  private

  # A late job from before this change must never mint a NEW generation when one already exists:
  # it would get a higher sequence than newer work and be allowed to publish over it (design A1).
  # It may only create the first generation of a portfolio that has none, where nothing can be
  # overwritten.
  def legacy_generation(session_id)
    portfolio = Session.unscoped.find_by(id: session_id)&.portfolio
    return nil unless portfolio

    generation = Portfolios::RequestGeneration.new(portfolio: portfolio, source: 'legacy_job', enqueue: false).call
    Rails.logger.warn("[N10] legacy_job_skipped session=#{session_id}: portfolio already has generations") unless generation
    generation
  end
end
