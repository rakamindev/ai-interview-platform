class AddFitGapReviewLifecycle < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :generation_status, :string, default: 'complete', null: false
    add_column :fit_gap_reports, :generation_token, :string
    add_column :fit_gap_reports, :requested_at, :datetime
    add_column :fit_gap_reports, :error_code, :string
    add_column :fit_gap_reports, :source_digest, :string
    change_column_default :fit_gap_reports, :skill_comparisons, from: nil, to: []
    add_check_constraint :fit_gap_reports,
      "generation_status IN ('pending', 'generating', 'complete', 'failed', 'stale')",
      name: 'chk_fit_gap_generation_status'
  end
end
