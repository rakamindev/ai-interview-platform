# frozen_string_literal: true

# Closes a cross-tenant IDOR: Portfolio, PortfolioSkill, AssessorOverride,
# CoverageMap, TranscriptTurn and FitGapReport had no tenant_id and relied on
# always being reached through an already-scoped parent (Session/Vacancy).
# Several controller actions bypassed that chain via a direct `.find`,
# letting any authenticated assessor read or overwrite another tenant's
# candidate data. See assessment/gap-analysis.md P0-1/P0-2.
#
# `sessions.tenant_id` is NOT NULL and every row below chains back to a
# session (directly or via portfolio) with a DB-enforced foreign key, so the
# backfill below is guaranteed complete — no orphan rows are possible under
# the current schema.
class AddTenantIdToPortfolioFamily < ActiveRecord::Migration[7.0]
  def up
    add_column :portfolios, :tenant_id, :bigint
    add_column :portfolio_skills, :tenant_id, :bigint
    add_column :assessor_overrides, :tenant_id, :bigint
    add_column :coverage_maps, :tenant_id, :bigint
    add_column :transcript_turns, :tenant_id, :bigint
    add_column :fit_gap_reports, :tenant_id, :bigint

    # Backfill in dependency order: sessions first, then anything derived
    # from a session, then anything derived from a portfolio.
    execute <<~SQL.squish
      UPDATE portfolios AS p SET tenant_id = s.tenant_id
      FROM sessions AS s WHERE p.session_id = s.id
    SQL

    execute <<~SQL.squish
      UPDATE coverage_maps AS cm SET tenant_id = s.tenant_id
      FROM sessions AS s WHERE cm.session_id = s.id
    SQL

    execute <<~SQL.squish
      UPDATE transcript_turns AS tt SET tenant_id = s.tenant_id
      FROM sessions AS s WHERE tt.session_id = s.id
    SQL

    execute <<~SQL.squish
      UPDATE portfolio_skills AS ps SET tenant_id = p.tenant_id
      FROM portfolios AS p WHERE ps.portfolio_id = p.id
    SQL

    execute <<~SQL.squish
      UPDATE assessor_overrides AS ao SET tenant_id = ps.tenant_id
      FROM portfolio_skills AS ps WHERE ao.portfolio_skill_id = ps.id
    SQL

    execute <<~SQL.squish
      UPDATE fit_gap_reports AS fgr SET tenant_id = p.tenant_id
      FROM portfolios AS p WHERE fgr.portfolio_id = p.id
    SQL

    change_column_null :portfolios, :tenant_id, false
    change_column_null :portfolio_skills, :tenant_id, false
    change_column_null :assessor_overrides, :tenant_id, false
    change_column_null :coverage_maps, :tenant_id, false
    change_column_null :transcript_turns, :tenant_id, false
    change_column_null :fit_gap_reports, :tenant_id, false

    add_index :portfolios, :tenant_id
    add_index :portfolio_skills, :tenant_id
    add_index :assessor_overrides, :tenant_id
    add_index :coverage_maps, :tenant_id
    add_index :transcript_turns, :tenant_id
    add_index :fit_gap_reports, :tenant_id
  end

  def down
    remove_column :portfolios, :tenant_id
    remove_column :portfolio_skills, :tenant_id
    remove_column :assessor_overrides, :tenant_id
    remove_column :coverage_maps, :tenant_id
    remove_column :transcript_turns, :tenant_id
    remove_column :fit_gap_reports, :tenant_id
  end
end
