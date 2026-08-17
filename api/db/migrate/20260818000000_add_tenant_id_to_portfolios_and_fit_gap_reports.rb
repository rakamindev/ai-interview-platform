# frozen_string_literal: true

# Adds tenant_id to portfolios and fit_gap_reports so the portfolio family
# (candidate assessment results) can be scoped to its owning tenant.
#
# Backfill strategy (safe against existing rows):
#   1. Add nullable columns.
#   2. Backfill portfolios.tenant_id from sessions.assessment.tenant_id.
#   3. Backfill fit_gap_reports.tenant_id from their portfolio.
#   4. Enforce NOT NULL only after backfill — rows without a reachable
#      session/portfolio would fail loudly at step 4 rather than silently
#      inheriting a wrong tenant.
class AddTenantIdToPortfoliosAndFitGapReports < ActiveRecord::Migration[7.0]
  def up
    add_column :portfolios, :tenant_id, :bigint
    add_column :fit_gap_reports, :tenant_id, :bigint

    # Orphan portfolios/fit_gap_reports (missing parent) get no tenant_id and
    # block the NOT NULL step below, so verify counts before enforcing.
    backfill_portfolios
    backfill_fit_gap_reports

    change_column_null :portfolios, :tenant_id, false
    change_column_null :fit_gap_reports, :tenant_id, false

    add_index :portfolios, :tenant_id
    add_index :fit_gap_reports, :tenant_id
  end

  def down
    remove_column :portfolios, :tenant_id
    remove_column :fit_gap_reports, :tenant_id
  end

  private

  def backfill_portfolios
    execute <<~SQL
      UPDATE portfolios
      SET tenant_id = s.tenant_id
      FROM sessions s
      WHERE s.id = portfolios.session_id
        AND portfolios.tenant_id IS NULL
    SQL
  end

  def backfill_fit_gap_reports
    execute <<~SQL
      UPDATE fit_gap_reports
      SET tenant_id = p.tenant_id
      FROM portfolios p
      WHERE p.id = fit_gap_reports.portfolio_id
        AND fit_gap_reports.tenant_id IS NULL
    SQL
  end
end