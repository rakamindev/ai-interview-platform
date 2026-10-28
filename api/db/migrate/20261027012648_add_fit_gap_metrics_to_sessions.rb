class AddFitGapMetricsToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :fit_gap_metrics, :jsonb
  end
end
