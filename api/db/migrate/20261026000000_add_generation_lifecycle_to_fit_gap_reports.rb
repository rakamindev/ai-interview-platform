# frozen_string_literal: true

class AddGenerationLifecycleToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    # Existing rows represent completed reports; keep them readable after migration.
    add_column :fit_gap_reports, :generation_status, :string, null: false, default: "complete"
    add_column :fit_gap_reports, :generation_error, :text
    # Shared enqueue/worker lease token. Old workers must not overwrite newer runs.
    add_column :fit_gap_reports, :generation_started_at, :datetime
    add_column :fit_gap_reports, :input_fingerprint, :string, limit: 64

    add_check_constraint :fit_gap_reports,
                         "generation_status IN ('queued', 'generating', 'complete', 'failed', 'stale')",
                         name: "chk_fit_gap_reports_generation_status"
  end
end
