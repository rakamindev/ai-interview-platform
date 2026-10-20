# frozen_string_literal: true

class AddNarrativeStatusToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :narrative_status, :string, null: false, default: 'unknown'
  end
end
