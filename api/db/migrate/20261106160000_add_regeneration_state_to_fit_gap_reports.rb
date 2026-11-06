# frozen_string_literal: true

# Fit-gap reports are no longer deleted on override. These columns keep the
# regeneration state so the old report stays readable while a new one is built.
#
# - stale: the report needs a refresh (new override, or a report without the new fields)
# - generation_error: generic message when the last regeneration failed
# - based_on_override_at: latest override already reflected in the report
#   (lets the worker skip duplicate jobs)
# - regeneration_requested_at: rate-limits re-queuing when a report is read
#
# Existing reports lack required_level/is_override, so they are marked stale
# and refreshed the first time they are read.
class AddRegenerationStateToFitGapReports < ActiveRecord::Migration[7.0]
  def up
    change_table :fit_gap_reports, bulk: true do |t|
      t.boolean  :stale, null: false, default: false
      t.text     :generation_error
      t.datetime :based_on_override_at
      t.datetime :regeneration_requested_at
    end

    execute 'UPDATE fit_gap_reports SET stale = TRUE'
  end

  def down
    change_table :fit_gap_reports, bulk: true do |t|
      t.remove :stale, :generation_error, :based_on_override_at, :regeneration_requested_at
    end
  end
end
