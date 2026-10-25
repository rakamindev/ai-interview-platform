# frozen_string_literal: true

class AddSourceFingerprintToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :source_fingerprint, :string
    add_index :fit_gap_reports, :source_fingerprint
  end
end
