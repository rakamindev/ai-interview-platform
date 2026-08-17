# frozen_string_literal: true

# Fit/gap reports now have a durable lifecycle (pending → generating →
# complete | failed). A pending report is created before the deterministic
# comparison is computed, so `skill_comparisons` must be nullable until the
# engine populates it. `culture_narrative` / `overall_narrative` were already
# nullable in the base schema.
class RelaxFitGapReportSkillComparisons < ActiveRecord::Migration[7.0]
  def up
    execute <<~SQL
      ALTER TABLE ai_interview.fit_gap_reports
        ALTER COLUMN skill_comparisons DROP NOT NULL;
    SQL
  end

  def down
    # Only restore NOT NULL if every row has comparisons (safe for existing data).
    null_rows = execute("SELECT 1 FROM ai_interview.fit_gap_reports WHERE skill_comparisons IS NULL LIMIT 1").ntuples
    if null_rows.zero?
      execute <<~SQL
        ALTER TABLE ai_interview.fit_gap_reports
          ALTER COLUMN skill_comparisons SET NOT NULL;
      SQL
    else
      Rails.logger.warn("[migrate] Skipping SET NOT NULL on fit_gap_reports.skill_comparisons — null rows exist")
    end
  end
end
