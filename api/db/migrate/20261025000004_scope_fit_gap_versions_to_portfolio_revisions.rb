# frozen_string_literal: true

class ScopeFitGapVersionsToPortfolioRevisions < ActiveRecord::Migration[7.0]
  def up
    remove_index :fit_gap_reports, name: 'idx_fit_gap_reports_revision'
    add_index :fit_gap_reports,
              [:portfolio_id, :vacancy_id, :portfolio_revision_id, :version],
              unique: true,
              name: 'idx_fit_gap_reports_revision'

    execute <<~SQL
      WITH ranked_reports AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY portfolio_id, vacancy_id, portfolio_revision_id
            ORDER BY generated_at ASC NULLS FIRST, id ASC
          ) AS scoped_version
        FROM fit_gap_reports
      )
      UPDATE fit_gap_reports
      SET version = ranked_reports.scoped_version
      FROM ranked_reports
      WHERE fit_gap_reports.id = ranked_reports.id
    SQL
  end

  def down
    # Version values are historical metadata and cannot be safely reconstructed.
  end
end
