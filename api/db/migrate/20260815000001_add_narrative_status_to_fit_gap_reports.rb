# frozen_string_literal: true

# When narrative generation failed, FitGap::Engine rescued to
# `{ culture: nil, overall: <rule-based fallback> }` and the client rendered
# `culture_narrative || overall_narrative` — so the fallback summary appeared
# under a "Culture & Competency Fit" heading with nothing indicating the AI call
# had failed. An assessor read a generated sentence as an analysis it was not.
#
# A nullable narrative cannot distinguish "failed" from "not requested", so the
# state is recorded explicitly rather than inferred from absence.
class AddNarrativeStatusToFitGapReports < ActiveRecord::Migration[7.0]
  def up
    create_enum :fit_gap_narrative_status, %w[complete failed skipped]

    add_column :fit_gap_reports, :narrative_status, :enum,
               enum_type: 'fit_gap_narrative_status', default: 'complete', null: false

    # Existing rows with no culture narrative are the ones that hit the rescue.
    execute(<<~SQL)
      UPDATE fit_gap_reports SET narrative_status = 'failed'
      WHERE culture_narrative IS NULL OR btrim(culture_narrative) = ''
    SQL
  end

  def down
    remove_column :fit_gap_reports, :narrative_status
    # drop_enum arrived in Rails 7.1; this app is on 7.0, so drop the type directly.
    execute('DROP TYPE IF EXISTS fit_gap_narrative_status')
  end
end
