# frozen_string_literal: true

# FitGap::Engine rescues every narrative failure, substitutes a mechanical
# one-line summary, and then saves the report with generated_at set. Nothing
# in the record distinguishes a report whose narrative came from the model
# from one whose narrative is a stub written after the model call failed —
# so the UI cannot warn the assessor, and neither can the PDF export.
#
# Portfolios already carry generation_status for exactly this reason. This
# gives fit/gap reports the same honesty about their own provenance.
class AddNarrativeStatusToFitGapReports < ActiveRecord::Migration[7.0]
  NARRATIVE_STATUSES = %w[complete fallback].freeze

  def up
    # Backfilled as 'complete' for existing rows: we cannot retroactively know
    # which historical narratives were fallbacks, and 'complete' preserves the
    # current rendering for rows written before this column existed.
    add_column :fit_gap_reports, :narrative_status, :string,
               null: false, default: 'complete', limit: 20

    add_check_constraint :fit_gap_reports,
                         "narrative_status IN ('complete', 'fallback')",
                         name: 'chk_fit_gap_reports_narrative_status'
  end

  def down
    remove_check_constraint :fit_gap_reports, name: 'chk_fit_gap_reports_narrative_status'
    remove_column :fit_gap_reports, :narrative_status
  end
end
