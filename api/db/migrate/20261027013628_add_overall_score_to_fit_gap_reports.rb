class AddOverallScoreToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :overall_score, :integer
  end
end
