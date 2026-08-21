# frozen_string_literal: true

class AddAdditionalStrengthsToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :additional_strengths, :jsonb, default: [], null: false
  end
end
