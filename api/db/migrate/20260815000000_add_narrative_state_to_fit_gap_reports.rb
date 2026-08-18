# frozen_string_literal: true

class AddNarrativeStateToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :narrative_status, :string, null: false, default: "pending"
    add_column :fit_gap_reports, :narrative_error, :text
    add_column :fit_gap_reports, :narrative_generated_at, :datetime
    add_column :fit_gap_reports, :narrative_generation, :integer, null: false, default: 0

    add_index :fit_gap_reports, :narrative_status
  end
end
