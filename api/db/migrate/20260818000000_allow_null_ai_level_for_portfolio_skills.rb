# frozen_string_literal: true

class AllowNullAiLevelForPortfolioSkills < ActiveRecord::Migration[7.0]
  def up
    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :portfolio_skills, :ai_confidence, true

    execute "ALTER TABLE portfolio_skills DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level;"
    execute "ALTER TABLE portfolio_skills ADD CONSTRAINT chk_portfolio_skills_ai_level CHECK (ai_level IS NULL OR (ai_level >= 1 AND ai_level <= 5));"
  end

  def down
    # Rows written after `up` may legitimately hold NULL (unassessed skills). Re-adding NOT NULL
    # would fail halfway through, so stop with a clear message and let someone decide on a backfill.
    unassessed = select_value('SELECT COUNT(*) FROM portfolio_skills WHERE ai_level IS NULL OR ai_confidence IS NULL').to_i
    if unassessed.positive?
      raise ActiveRecord::IrreversibleMigration,
            "#{unassessed} portfolio_skills rows have no ai_level/ai_confidence; backfill or remove them before rolling back"
    end

    execute "ALTER TABLE portfolio_skills DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level;"
    execute "ALTER TABLE portfolio_skills ADD CONSTRAINT chk_portfolio_skills_ai_level CHECK (ai_level >= 1 AND ai_level <= 5);"

    change_column_null :portfolio_skills, :ai_confidence, false
    change_column_null :portfolio_skills, :ai_level, false
  end
end
