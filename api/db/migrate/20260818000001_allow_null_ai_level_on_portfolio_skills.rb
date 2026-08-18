# frozen_string_literal: true

# Allow ai_level to be NULL in portfolio_skills to represent skills
# that were configured for assessment but never evaluated by the AI
# (e.g., ran out of time, conversation didn't reach that skill).
#
# Previously, the NOT NULL constraint + .to_i.clamp(1,5) in the
# generator silently assigned L1 to unevaluated skills, penalizing
# candidates with fabricated low ratings.
class AllowNullAiLevelOnPortfolioSkills < ActiveRecord::Migration[7.0]
  def up
    # 1. Drop the existing CHECK constraint
    execute <<~SQL
      ALTER TABLE portfolio_skills
        DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level;
    SQL

    # 2. Allow NULL on the column
    change_column_null :portfolio_skills, :ai_level, true

    # 3. Add a new CHECK that permits NULL or valid 1–5
    execute <<~SQL
      ALTER TABLE portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_ai_level
        CHECK (ai_level IS NULL OR (ai_level >= 1 AND ai_level <= 5));
    SQL
  end

  def down
    # To reverse: set any NULLs to a sentinel before restoring NOT NULL.
    # We use 0 as a temporary value that the application can detect,
    # but the safer approach is to fail loudly if NULLs exist.
    if PortfolioSkill.where(ai_level: nil).exists?
      raise ActiveRecord::IrreversibleMigration,
            "Cannot restore NOT NULL: portfolio_skills rows with ai_level = NULL exist. " \
            "Manually assign levels before rolling back."
    end

    execute <<~SQL
      ALTER TABLE portfolio_skills
        DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level;
    SQL

    change_column_null :portfolio_skills, :ai_level, false

    execute <<~SQL
      ALTER TABLE portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_ai_level
        CHECK (ai_level >= 1 AND ai_level <= 5);
    SQL
  end
end
