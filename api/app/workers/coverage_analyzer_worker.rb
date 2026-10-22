# frozen_string_literal: true

class CoverageAnalyzerWorker
  include Sidekiq::Worker

  sidekiq_options queue: :coverage, retry: 0  # non-critical — no retry

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
    Rails.logger.warn("[N7] Session #{session_id} not found — skipping")
  rescue => e
    # N7 failure is non-critical — log and let the interview continue
    Rails.logger.error("[N7] Coverage analyzer failed for session #{session_id}: #{e.class} #{e.message}")
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
