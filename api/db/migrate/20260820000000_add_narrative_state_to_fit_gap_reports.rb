# frozen_string_literal: true

# Splits "the comparison" (deterministic, always present) from "the narrative" (AI, may fail).
# Safe on existing rows: every new column is nullable or has a default, existing reports are
# treated as already-narrated ("ready"), and the legacy skill_comparisons shape is normalised on read.
class AddNarrativeStateToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :narrative_status, :string, null: false, default: 'ready'
    add_column :fit_gap_reports, :narrative_digest, :string
    add_column :fit_gap_reports, :generation_error, :string, limit: 255
    add_column :fit_gap_reports, :summary, :jsonb, null: false, default: {}

    add_check_constraint :fit_gap_reports,
                         "narrative_status IN ('pending', 'ready', 'failed')",
                         name: 'chk_fit_gap_reports_narrative_status'
  end
end
