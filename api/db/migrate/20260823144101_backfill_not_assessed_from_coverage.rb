class BackfillNotAssessedFromCoverage < ActiveRecord::Migration[7.0]
  # Data cleanup for rows written before the fix: the old generator stored a
  # fabricated ai_level (clamped to 1) for skills the AI never probed. Null those
  # out so they read as "not assessed" — but ONLY where the session's coverage map
  # shows the skill was never touched (state = 'not_yet'). A blanket
  # "ai_level = 1 -> NULL" would also erase genuine L1 ratings; the coverage map is
  # the only thing that distinguishes a fabricated 1 from an earned one.
  def up
    execute <<~SQL
      UPDATE portfolio_skills ps
      SET ai_level = NULL
      FROM portfolios p, sessions s, coverage_maps cm
      WHERE ps.portfolio_id = p.id
        AND s.id = p.session_id
        AND cm.session_id = s.id
        AND lower(cm.skill_label) = lower(ps.skill_label)
        AND ps.is_discovered = false
        AND cm.state = 'not_yet'
    SQL
  end

  def down
    # One-way data cleanup: once fabricated 1s are nulled we cannot tell which
    # nulls were originally fabricated, so this cannot be safely reversed. The
    # schema change (AllowNullAiLevelOnPortfolioSkills) IS reversible; this data
    # backfill deliberately is not.
    raise ActiveRecord::IrreversibleMigration
  end
end
