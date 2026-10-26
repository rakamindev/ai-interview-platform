# frozen_string_literal: true

# Gives fit/gap reports a lifecycle and provenance so the UI never has to
# guess: pending → generating → complete | failed, plus a digest of the
# inputs used (to detect outdated reports after an override) and whether the
# narrative came from the model or from the deterministic fallback.
#
# Safe on existing rows: they were all written by a finished job, so they are
# backfilled as `complete` via the column default before the default flips to
# `pending` for new rows. Fully reversible.
#
# The table has no updated_at, so queue/claim times are explicit columns:
# they are the leases that let a lost or crashed job be recovered.
class AddLifecycleToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :status, :enum, enum_type: :generation_status, null: false, default: 'complete'
    change_column_default :fit_gap_reports, :status, from: 'complete', to: 'pending'

    add_column :fit_gap_reports, :error_message, :text
    add_column :fit_gap_reports, :inputs_digest, :string, limit: 64
    add_column :fit_gap_reports, :narrative_source, :string, limit: 20
    add_column :fit_gap_reports, :queued_at, :datetime
    add_column :fit_gap_reports, :generation_started_at, :datetime
    add_check_constraint :fit_gap_reports, "narrative_source IN ('ai', 'fallback')",
                         name: 'chk_fit_gap_reports_narrative_source'

    change_column_default :fit_gap_reports, :skill_comparisons, from: nil, to: []
  end
end
