# frozen_string_literal: true

class CoverageAnalyzerWorker
  include Sidekiq::Worker

  # Two retries, seconds apart — not zero, and not many.
  #
  # "Non-critical" was the wrong reading. A lost analysis is a lost probe: the
  # coverage map under-counts, which under-states the confidence the portfolio
  # may later claim, and mis-directs `priority_next` so the interviewer probes
  # the wrong skill next. Nobody sees it happen. Measured against the live API,
  # five of eleven calls returned 503 in a single session.
  #
  # It stays bounded because the result is only useful while the conversation is
  # still near those turns. A stale map arriving four exchanges later is worse
  # than no map, so this backs off quickly and then gives up rather than
  # queueing work whose answer has expired.
  sidekiq_options queue: :coverage, retry: 2

  sidekiq_retry_in { |count, _exception| [3, 8][count] || 8 }

  sidekiq_retries_exhausted do |msg, ex|
    Rails.logger.error(
      "[N7] Coverage analysis permanently failed for session #{msg['args'].first} " \
      "turn #{msg['args'].second}: #{ex&.class} #{ex&.message}. " \
      'Coverage map is now behind the transcript for this turn.'
    )
  end

  def perform(session_id, turn_number)
    session = Session.find(session_id)

    return if session.ended?

    result = Coverage::Analyzer.new(session: session).call

    apply_updates(session, result[:skill_updates])
    create_discovered_skills(session, result[:discovered_skills])

    # Pass the IDs of maps just updated this run so we never auto-advance a
    # skill that was touched in the same job (it isn't stale yet).
    updated_ids = result[:skill_updates].filter_map { |u| u[:coverage_map_id] }
    advance_stale_partials(session, exclude_ids: updated_ids)

    publish_coverage_update(session)
    # Session-end detection removed from worker (H1 fix) — the middleware owns
    # session lifecycle because it's the only component with access to both the
    # Gemini client and the browser WebSocket. The worker updating DB state and
    # the middleware checking it on the next AI turn avoids the duplicate-end race.

    Rails.logger.info("[N7] Coverage analyzed for session #{session_id}, turn #{turn_number}")
  rescue ActiveRecord::RecordNotFound
    # The session is gone. Retrying cannot help, so swallow this one.
    Rails.logger.warn("[N7] Session #{session_id} not found — skipping")
  rescue StandardError => e
    # Previously swallowed here, which is why the failure was invisible: the
    # interview carried on against a coverage map that had quietly stopped
    # advancing. Re-raise so Sidekiq can retry — the interview still carries on
    # either way, because this worker runs asynchronously and never blocks a
    # turn, but now a transient API error gets a second chance instead of
    # costing a probe outright.
    Rails.logger.error("[N7] Coverage analyzer failed for session #{session_id}: #{e.class} #{e.message}")
    raise
  end

  private

  def apply_updates(session, skill_updates)
    skill_updates.each do |update|
      session.coverage_maps
             .find_by(id: update[:coverage_map_id])
             &.update!(
               state:       update[:new_state],
               probe_count: update[:new_probe_count],
               last_signal: update[:last_signal]
             )
    end
  end

  def create_discovered_skills(session, discovered_skills)
    discovered_skills.each do |discovered|
      next if session.coverage_maps.exists?(skill_label: discovered[:label])
      next if session.coverage_maps.discovered.count >= 10

      session.coverage_maps.create!(
        skill_id:      nil,
        skill_label:   discovered[:label],
        is_discovered: true,
        state:         'initiated',
        probe_count:   1,
        last_signal:   discovered[:first_mention]
      )
    end
  end

  def publish_coverage_update(session)
    maps       = session.coverage_maps.configured.order(:id)
    discovered = session.coverage_maps.discovered.order(:id)

    payload = {
      type:      'coverage_update',
      skills:    maps.map { |m| coverage_json(m) },
      discovered: discovered.map { |m| coverage_json(m) }
    }.to_json

    # H5 fix: use Sidekiq's pooled Redis connection instead of creating
    # a new (leaked) connection on every publish.
    Sidekiq.redis { |conn| conn.publish("coverage:#{session.id}", payload) }
  rescue => e
    Rails.logger.error("[N7] Failed to publish coverage update: #{e.message}")
  end

  # Auto-advance skills that are partial but have fallen outside the analyzer's
  # context window (last TURNS_CONTEXT turns). Once a skill leaves the window,
  # Flash can't see it and will never promote it — so we promote here if there's
  # enough evidence (probe_count >= 4).
  #
  # exclude_ids: coverage_map IDs updated in this same job run — those were just
  # discussed and are NOT stale yet.
  def advance_stale_partials(session, exclude_ids: [])
    scope = session.coverage_maps
                   .where(state: 'partial')
                   .where('probe_count >= ?', 4)
    scope = scope.where.not(id: exclude_ids) if exclude_ids.any?

    scope.each do |map|
      map.update!(state: 'covered', last_signal: 'Auto-advanced: outside context window with sufficient probes')
      Rails.logger.info("[N7] Auto-advanced #{map.skill_label} to covered (probe_count=#{map.probe_count})")
    end
  end

  def coverage_json(map)
    {
      id:            map.id,
      skill_id:      map.skill_id,
      skill_label:   map.skill_label,
      is_discovered: map.is_discovered,
      state:         map.state,
      probe_count:   map.probe_count,
      last_signal:   map.last_signal
    }
  end
end
