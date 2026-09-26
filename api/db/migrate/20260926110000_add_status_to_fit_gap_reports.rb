# frozen_string_literal: true

# A fit/gap job that exhausts its retries used to leave no trace, so the UI
# polled a 404 forever. `status` lets the worker record a terminal 'failed'
# state. Existing rows are real reports, so the default is 'complete'.
class AddStatusToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :status, :string, default: "complete", null: false
    add_column :fit_gap_reports, :error, :text
  end
end
