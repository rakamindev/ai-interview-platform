# frozen_string_literal: true

class AddLifecycleToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :source_fingerprint, :string, limit: 64
    add_column :fit_gap_reports, :requested_fingerprint, :string, limit: 64
    add_column :fit_gap_reports, :generation_status, :string, null: false, default: 'complete'
    add_column :fit_gap_reports, :generation_error, :text

    add_check_constraint :fit_gap_reports,
                         "generation_status IN ('complete', 'generating', 'failed')",
                         name: 'chk_fit_gap_reports_generation_status'
  end
end
