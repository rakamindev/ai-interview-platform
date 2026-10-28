# frozen_string_literal: true

# Version of the comparison rules a report was generated with. Existing reports were built before
# unmeasured skills were separated from gaps, so they get 1 and are shown as stale.
class AddRulesVersionToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :rules_version, :integer, null: false, default: 1
  end
end
