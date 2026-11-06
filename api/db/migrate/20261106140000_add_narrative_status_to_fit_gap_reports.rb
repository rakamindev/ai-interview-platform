# frozen_string_literal: true

# W17: record whether the fit/gap narrative was written by the AI or is unavailable, so the UI never
# presents a fallback sentence as analysis. Existing reports that hold the old canned fallback
# ("Candidate shows N skill matches, ...") with no culture narrative are marked unavailable and their
# canned text is moved out of overall_narrative. A report with no narrative text at all is also
# unavailable (this also keeps up -> down -> up consistent). Every other report is marked generated.
class AddNarrativeStatusToFitGapReports < ActiveRecord::Migration[7.0]
  CANNED = "overall_narrative ~ '^Candidate shows [0-9]+ skill matches, [0-9]+ exceeds, and [0-9]+ gaps against role requirements\\.$' " \
           'AND culture_narrative IS NULL'

  def up
    add_column :fit_gap_reports, :narrative_status, :string, null: false, default: 'generated'
    execute "UPDATE fit_gap_reports SET narrative_status = 'unavailable', overall_narrative = NULL WHERE #{CANNED}"
    execute "UPDATE fit_gap_reports SET narrative_status = 'unavailable' " \
            "WHERE COALESCE(TRIM(culture_narrative), '') = '' AND COALESCE(TRIM(overall_narrative), '') = ''"
  end

  def down
    # The canned sentence only restated the table's counts; it is not restored.
    remove_column :fit_gap_reports, :narrative_status
  end
end
