class AddGenerationErrorToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :generation_error, :text
  end
end
