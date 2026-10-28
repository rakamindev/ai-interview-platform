# frozen_string_literal: true

class AddGenerationStatusToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :generation_status, :enum,
               enum_type: "generation_status", default: "complete", null: false
    add_column :fit_gap_reports, :generation_started_at, :datetime
    add_column :fit_gap_reports, :generation_token, :string
  end
end
