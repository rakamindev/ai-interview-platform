# frozen_string_literal: true

# Lets a fit/gap report say whether it is still generating, ready or failed, and whether its
# narrative came from the model or the rule-based fallback. Additive and reversible: existing
# rows are finished reports, so the 'ready' default backfills them correctly; narrative_source
# stays NULL ("unknown") for them.
class AddLifecycleToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :status, :string, limit: 20, null: false, default: 'ready'
    add_column :fit_gap_reports, :narrative_source, :string, limit: 20
    add_column :fit_gap_reports, :error_message, :text
    change_column_default :fit_gap_reports, :skill_comparisons, from: nil, to: []

    add_check_constraint :fit_gap_reports, "status IN ('generating', 'ready', 'failed')",
                         name: 'chk_fit_gap_reports_status'
    add_check_constraint :fit_gap_reports, "narrative_source IS NULL OR narrative_source IN ('ai', 'fallback')",
                         name: 'chk_fit_gap_reports_narrative_source'
  end
end
