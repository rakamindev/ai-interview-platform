class AddHistoryTrackingToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :vacancy_title, :string
    add_column :fit_gap_reports, :trigger_reason, :string
  end
end
