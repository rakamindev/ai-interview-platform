# frozen_string_literal: true

# The DB check constraint was ai_level >= 0, but the model validates 1..5
# and the portfolio generator clamps to 1..5. Level 0 has no semantic meaning
# in this system — a skill assessed at level 0 would mean "no competency detected"
# which is represented by absence from the portfolio, not a level-0 row.
# This migration tightens the constraint to match the model and generator.
class TightenPortfolioSkillsAiLevelConstraint < ActiveRecord::Migration[7.0]
  def up
    # Remove old loose constraint
    execute <<~SQL
      ALTER TABLE portfolio_skills
        DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level;
    SQL

    # Re-add with corrected lower bound
    execute <<~SQL
      ALTER TABLE portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_ai_level
        CHECK (ai_level >= 1 AND ai_level <= 5);
    SQL
  end

  def down
    execute <<~SQL
      ALTER TABLE portfolio_skills
        DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level;
    SQL

    execute <<~SQL
      ALTER TABLE portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_ai_level
        CHECK (ai_level >= 0 AND ai_level <= 5);
    SQL
  end
end
