class AddOverrideContextToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :override_context, :jsonb, null: false, default: []
  end
end
