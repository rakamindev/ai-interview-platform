# frozen_string_literal: true

class AllowNullAiLevelOnPortfolioSkillsAndAddAssessedFlag < ActiveRecord::Migration[7.0]
  def up
    add_column :portfolio_skills, :is_assessed, :boolean, default: true, null: false unless column_exists?(:portfolio_skills, :is_assessed)
    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :portfolio_skills, :competency_summary, true

    execute "ALTER TABLE portfolio_skills DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level"
    execute "ALTER TABLE portfolio_skills ADD CONSTRAINT chk_portfolio_skills_ai_level CHECK (ai_level IS NULL OR (ai_level >= 1 AND ai_level <= 5))"
  end

  def down
    # Set default values for any unassessed rows before re-enforcing NOT NULL
    execute "UPDATE portfolio_skills SET ai_level = 1 WHERE ai_level IS NULL"
    execute "UPDATE portfolio_skills SET competency_summary = 'Not assessed' WHERE competency_summary IS NULL"

    execute "ALTER TABLE portfolio_skills DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level"
    execute "ALTER TABLE portfolio_skills ADD CONSTRAINT chk_portfolio_skills_ai_level CHECK (ai_level >= 1 AND ai_level <= 5)"

    change_column_null :portfolio_skills, :ai_level, false
    change_column_null :portfolio_skills, :competency_summary, false
    remove_column :portfolio_skills, :is_assessed if column_exists?(:portfolio_skills, :is_assessed)
  end
end
