# frozen_string_literal: true

class AddGenerationStateToFitGapReports < ActiveRecord::Migration[7.0]
  def up
    add_column :fit_gap_reports, :generation_status, :string,
               null: false, default: 'pending'
    add_column :fit_gap_reports, :generation_error, :string

    # Reports that predate lifecycle tracking were only persisted after a
    # successful generation, so they are safe to mark complete.
    execute <<~SQL.squish
      UPDATE fit_gap_reports
      SET generation_status = 'complete'
      WHERE generated_at IS NOT NULL
    SQL

    add_index :fit_gap_reports, :generation_status
    add_check_constraint :fit_gap_reports,
                         "generation_status IN ('pending', 'generating', 'complete', 'failed')",
                         name: 'chk_fit_gap_reports_generation_status'
  end

  def down
    remove_check_constraint :fit_gap_reports,
                            name: 'chk_fit_gap_reports_generation_status'
    remove_index :fit_gap_reports, :generation_status
    remove_column :fit_gap_reports, :generation_error
    remove_column :fit_gap_reports, :generation_status
  end
end
