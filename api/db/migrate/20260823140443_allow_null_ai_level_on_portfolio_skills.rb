class AllowNullAiLevelOnPortfolioSkills < ActiveRecord::Migration[7.0]
  # up: allow ai_level to be NULL = "not assessed". Existing rows keep their 1-5
  #     values, so this is safe against existing data. The CHECK (1..5) already
  #     tolerates NULL, so it stays untouched.
  # down: reversible but lossy — backfill NULL -> 1 (re-fabricates) so NOT NULL can
  #       be restored. Rollback deliberately returns to the old broken behavior.
  def up
    change_column_null :portfolio_skills, :ai_level, true
  end

  def down
    execute "UPDATE portfolio_skills SET ai_level = 1 WHERE ai_level IS NULL"
    change_column_null :portfolio_skills, :ai_level, false
  end
end
