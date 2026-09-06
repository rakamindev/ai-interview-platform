# frozen_string_literal: true

class AddTenantIdToPortfoliosAndFitgap < ActiveRecord::Migration[7.0]
  def up
    execute 'SET search_path TO ai_interview, public'

    # ── portfolios ───────────────────────────────────────────────────────────
    add_column :portfolios, :tenant_id, :bigint

    # Backfill dari session.tenant_id
    execute <<~SQL
      UPDATE portfolios p
      SET    tenant_id = s.tenant_id
      FROM   sessions s
      WHERE  s.id = p.session_id
    SQL

    # Cek orphaned portfolios (portfolio tanpa session valid) — harus 0
    orphans = execute('SELECT COUNT(*) FROM portfolios WHERE tenant_id IS NULL').first['count'].to_i
    raise "Found #{orphans} portfolios with NULL tenant_id after backfill" if orphans.positive?

    change_column_null :portfolios, :tenant_id, false
    add_index :portfolios, :tenant_id, name: 'index_portfolios_on_tenant_id'

    # ── fit_gap_reports ───────────────────────────────────────────────────────
    add_column :fit_gap_reports, :tenant_id, :bigint

    # Backfill dari portfolio -> session.tenant_id
    execute <<~SQL
      UPDATE fit_gap_reports fgr
      SET    tenant_id = s.tenant_id
      FROM   portfolios p
      JOIN   sessions s ON s.id = p.session_id
      WHERE  p.id = fgr.portfolio_id
    SQL

    orphans = execute('SELECT COUNT(*) FROM fit_gap_reports WHERE tenant_id IS NULL').first['count'].to_i
    raise "Found #{orphans} fit_gap_reports with NULL tenant_id after backfill" if orphans.positive?

    change_column_null :fit_gap_reports, :tenant_id, false
    add_index :fit_gap_reports, :tenant_id, name: 'index_fit_gap_reports_on_tenant_id'
  end

  def down
    execute 'SET search_path TO ai_interview, public'

    remove_index  :portfolios,      name: 'index_portfolios_on_tenant_id'
    remove_column :portfolios,      :tenant_id
    remove_index  :fit_gap_reports, name: 'index_fit_gap_reports_on_tenant_id'
    remove_column :fit_gap_reports, :tenant_id
  end
end
