# frozen_string_literal: true

class AllowUnassessedPortfolioSkills < ActiveRecord::Migration[7.0]
  def up
    # 1. Drop existing constraint that strictly requires ai_level between 1 and 5
    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level;
    SQL

    # 2. Allow NULL on ai_level so unassessed skills can have nil rating
    change_column_null :portfolio_skills, :ai_level, true

    # 3. Add new check constraint: ai_level must be NULL OR between 1 and 5
    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_ai_level
        CHECK (ai_level IS NULL OR (ai_level BETWEEN 1 AND 5));
    SQL

    # 4. Add status column to distinguish assessed vs unassessed explicitly
    add_column :portfolio_skills, :status, :string, default: 'assessed', null: false
  end

  def down
    # Remove status column
    remove_column :portfolio_skills, :status

    # Update any NULL ai_level to 1 to allow NOT NULL constraint re-application
    execute <<~SQL
      UPDATE ai_interview.portfolio_skills SET ai_level = 1 WHERE ai_level IS NULL;
      ALTER TABLE ai_interview.portfolio_skills
        DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level;
      ALTER TABLE ai_interview.portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_ai_level
        CHECK (ai_level BETWEEN 1 AND 5);
    SQL

    change_column_null :portfolio_skills, :ai_level, false
  end
end
