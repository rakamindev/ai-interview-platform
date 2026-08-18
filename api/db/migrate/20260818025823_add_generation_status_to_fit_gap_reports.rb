# frozen_string_literal: true

class AddGenerationStatusToFitGapReports < ActiveRecord::Migration[7.0]
  # New reports start as 'pending' — the worker flips them to 'generating' then
  # 'complete'. Existing (already generated) reports backfill to 'complete'.
  def up
    add_column :fit_gap_reports, :generation_status, :string, default: 'pending', null: false
    execute <<~SQL
      UPDATE fit_gap_reports
      SET generation_status = 'complete'
      WHERE generated_at IS NOT NULL
    SQL
  end

  def down
    remove_column :fit_gap_reports, :generation_status
  end
end