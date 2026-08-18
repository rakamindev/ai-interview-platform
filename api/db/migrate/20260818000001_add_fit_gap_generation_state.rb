class AddFitGapGenerationState < ActiveRecord::Migration[7.0]
  def up
    add_column :fit_gap_reports, :generation_status, :string
    add_column :fit_gap_reports, :generation_error, :text
    add_column :fit_gap_reports, :generation_started_at, :datetime, precision: 6
    add_column :fit_gap_reports, :generation_token, :string, limit: 64

    execute <<~SQL
      UPDATE ai_interview.fit_gap_reports
      SET generation_status = 'failed',
          generation_error = 'Fit/gap report requires regeneration after the assessment review update.'
      WHERE generation_status IS NULL
    SQL

    change_column_default :fit_gap_reports, :generation_status, from: nil, to: "pending"
    change_column_null :fit_gap_reports, :generation_status, false

    execute <<~SQL
      ALTER TABLE ai_interview.fit_gap_reports
        ADD CONSTRAINT chk_fit_gap_reports_generation_status
        CHECK (generation_status IN ('pending', 'generating', 'complete', 'failed'))
    SQL
  end

  def down
    execute <<~SQL
      ALTER TABLE ai_interview.fit_gap_reports
        DROP CONSTRAINT IF EXISTS chk_fit_gap_reports_generation_status
    SQL

    remove_column :fit_gap_reports, :generation_token
    remove_column :fit_gap_reports, :generation_started_at
    remove_column :fit_gap_reports, :generation_error
    remove_column :fit_gap_reports, :generation_status
  end
end
