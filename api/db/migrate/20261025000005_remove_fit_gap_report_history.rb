# frozen_string_literal: true

class RemoveFitGapReportHistory < ActiveRecord::Migration[7.0]
  def up
    remove_index :fit_gap_reports, name: 'idx_fit_gap_reports_revision'

    execute <<~SQL
      DELETE FROM fit_gap_reports older
      USING fit_gap_reports newer
      WHERE older.portfolio_id = newer.portfolio_id
        AND older.vacancy_id = newer.vacancy_id
        AND older.portfolio_revision_id IS NOT DISTINCT FROM newer.portfolio_revision_id
        AND (
          COALESCE(older.generated_at, TIMESTAMP 'epoch') < COALESCE(newer.generated_at, TIMESTAMP 'epoch')
          OR (COALESCE(older.generated_at, TIMESTAMP 'epoch') = COALESCE(newer.generated_at, TIMESTAMP 'epoch') AND older.id < newer.id)
        )
    SQL

    remove_column :fit_gap_reports, :version

    add_index :fit_gap_reports,
              [:portfolio_id, :vacancy_id],
              unique: true,
              where: 'portfolio_revision_id IS NULL',
              name: 'idx_fit_gap_reports_current'
    add_index :fit_gap_reports,
              [:portfolio_id, :vacancy_id, :portfolio_revision_id],
              unique: true,
              where: 'portfolio_revision_id IS NOT NULL',
              name: 'idx_fit_gap_reports_revision'
  end

  def down
    remove_index :fit_gap_reports, name: 'idx_fit_gap_reports_current'
    remove_index :fit_gap_reports, name: 'idx_fit_gap_reports_revision'
    add_column :fit_gap_reports, :version, :integer, null: false, default: 1
    add_index :fit_gap_reports,
              [:portfolio_id, :vacancy_id, :portfolio_revision_id, :version],
              unique: true,
              name: 'idx_fit_gap_reports_revision'
  end
end
