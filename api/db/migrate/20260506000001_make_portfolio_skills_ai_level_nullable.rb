# frozen_string_literal: true

class MakePortfolioSkillsAiLevelNullable < ActiveRecord::Migration[7.0]
  def up
    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :portfolio_skills, :ai_confidence, true
    change_column_null :portfolio_skills, :competency_summary, true

    execute <<~SQL
      ALTER TABLE portfolio_skills DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level;
      ALTER TABLE portfolio_skills ADD CONSTRAINT chk_portfolio_skills_ai_level
        CHECK (ai_level IS NULL OR (ai_level >= 1 AND ai_level <= 5));
    SQL

    change_column_null :assessor_overrides, :ai_level, true

    execute <<~SQL
      ALTER TABLE assessor_overrides DROP CONSTRAINT IF EXISTS chk_overrides_ai_level;
      ALTER TABLE assessor_overrides ADD CONSTRAINT chk_overrides_ai_level
        CHECK (ai_level IS NULL OR (ai_level >= 1 AND ai_level <= 5));
    SQL
  end

  def down
    execute <<~SQL
      ALTER TABLE portfolio_skills DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level;
      ALTER TABLE portfolio_skills ADD CONSTRAINT chk_portfolio_skills_ai_level
        CHECK (ai_level >= 1 AND ai_level <= 5);
      ALTER TABLE assessor_overrides DROP CONSTRAINT IF EXISTS chk_overrides_ai_level;
      ALTER TABLE assessor_overrides ADD CONSTRAINT chk_overrides_ai_level
        CHECK (ai_level >= 1 AND ai_level <= 5);
    SQL

    change_column_null :portfolio_skills, :ai_level, false
    change_column_null :portfolio_skills, :ai_confidence, false
    change_column_null :portfolio_skills, :competency_summary, false
    change_column_null :assessor_overrides, :ai_level, false
  end
end
