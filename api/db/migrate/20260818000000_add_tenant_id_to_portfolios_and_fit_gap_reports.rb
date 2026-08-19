# frozen_string_literal: true

# Portfolio and FitGapReport were the only AI-interview-schema tables never
# given a tenant_id, so nothing scoped them to an organization (see
# app/models/concerns/tenant_scoped.rb, and Assessment/Session/Vacancy for
# the existing pattern this migration extends). Any authenticated
# assessor/admin JWT — valid for any tenant — could look these up by raw
# sequential ID and read or mutate another organization's candidate data.
class AddTenantIdToPortfoliosAndFitGapReports < ActiveRecord::Migration[7.0]
  def up
    add_column :portfolios, :tenant_id, :bigint
    add_column :fit_gap_reports, :tenant_id, :bigint

    execute <<~SQL.squish
      UPDATE portfolios
      SET tenant_id = sessions.tenant_id
      FROM sessions
      WHERE sessions.id = portfolios.session_id
    SQL

    execute <<~SQL.squish
      UPDATE fit_gap_reports
      SET tenant_id = portfolios.tenant_id
      FROM portfolios
      WHERE portfolios.id = fit_gap_reports.portfolio_id
    SQL

    change_column_null :portfolios, :tenant_id, false
    change_column_null :fit_gap_reports, :tenant_id, false

    add_index :portfolios, :tenant_id
    add_index :fit_gap_reports, :tenant_id
  end

  def down
    remove_index :portfolios, :tenant_id
    remove_index :fit_gap_reports, :tenant_id
    remove_column :fit_gap_reports, :tenant_id
    remove_column :portfolios, :tenant_id
  end
end
