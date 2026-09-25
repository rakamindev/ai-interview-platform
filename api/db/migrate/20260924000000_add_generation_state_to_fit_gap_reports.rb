# frozen_string_literal: true

class AddGenerationStateToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    # Existing reports are already generated, so "complete" is the safe
    # backfill. New reports can be created as pending before Sidekiq runs.
    add_column :fit_gap_reports, :generation_status, :string,
               null: false, default: 'complete'
    add_column :fit_gap_reports, :generation_error, :text
    add_index :fit_gap_reports, :generation_status
  end
end
