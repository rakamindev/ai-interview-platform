# frozen_string_literal: true

class AddTenantIdToFitGapReports < ActiveRecord::Migration[7.0]
  def up
    # 1. Add column (nullable initially for backfill)
    add_column :fit_gap_reports, :tenant_id, :bigint

    # 2. Backfill tenant_id from portfolio.tenant_id
    execute <<~SQL
      UPDATE fit_gap_reports
      SET tenant_id = portfolios.tenant_id
      FROM portfolios
      WHERE fit_gap_reports.portfolio_id = portfolios.id
    SQL

    # 3. Verify backfill (all rows must have tenant_id)
    null_count = execute("SELECT COUNT(*) FROM fit_gap_reports WHERE tenant_id IS NULL").first['count'].to_i
    raise "Backfill failed: #{null_count} fit_gap_reports still have NULL tenant_id" if null_count > 0

    # 4. Add NOT NULL constraint
    change_column_null :fit_gap_reports, :tenant_id, false

    # 5. Add foreign key and index
    add_foreign_key :fit_gap_reports, :organizations, column: :tenant_id
    add_index :fit_gap_reports, :tenant_id
  end

  def down
    remove_foreign_key :fit_gap_reports, :organizations
    remove_index :fit_gap_reports, :tenant_id
    remove_column :fit_gap_reports, :tenant_id
  end
end
