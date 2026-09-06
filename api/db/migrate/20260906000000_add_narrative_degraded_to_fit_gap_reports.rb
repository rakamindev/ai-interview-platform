# Records whether a fit/gap report's narrative came from the language model or
# from the rule-based fallback used when that call fails.
#
# Without this column a degraded report is indistinguishable from a complete one:
# FitGap::Engine rescues a failed narrative call and stores a counted summary,
# which the UI then renders under the heading "Culture & Competency Fit" as if a
# qualitative analysis had run.
#
# Safety notes for review:
#   - Reversible: `add_column` inside `change` reverses to `remove_column`.
#   - Safe against existing rows: `default: false` backfills every existing
#     report, so `null: false` holds immediately. Existing reports were generated
#     before this distinction was tracked, and `false` is the honest value for
#     them — it preserves today's rendering rather than retroactively labelling
#     historical reports as degraded.
#   - No table rewrite: PostgreSQL 11+ stores a non-volatile column default as
#     catalog metadata, so this is O(1) regardless of table size and takes no
#     long-lived exclusive lock.
class AddNarrativeDegradedToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :narrative_degraded, :boolean, default: false, null: false
  end
end
