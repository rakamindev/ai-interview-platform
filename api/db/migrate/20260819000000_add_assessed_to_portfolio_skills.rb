# frozen_string_literal: true

# Allow a portfolio skill to be honestly flagged as "not assessed".
#
# Previously `ai_level` / `ai_confidence` were NOT NULL, so the portfolio
# generator was forced to fabricate an L1 rating (level.to_i.clamp(1,5) on nil
# -> 1) for skills the interview never probed — or worse, crash the whole
# portfolio generation when Gemini omitted the skill entirely. That produced
# misleading candidate reports (fake L1) and flaky end-to-end failures.
#
# This migration makes level/confidence nullable and adds an explicit `assessed`
# flag. Existing rows keep their values (`assessed` defaults to true) so the
# change is safe against already-stored data. The reverse restores NOT NULL
# constraints and drops the flag.
class AddAssessedToPortfolioSkills < ActiveRecord::Migration[7.0]
  def up
    add_column :portfolio_skills, :assessed, :boolean, null: false, default: true

    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :portfolio_skills, :ai_confidence, true

    # Keep the DB honest: only assessed skills may carry a level.
    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_ai_level'
    add_check_constraint :portfolio_skills,
                         'NOT assessed OR ai_level IS NULL OR (ai_level >= 1 AND ai_level <= 5)',
                         name: 'chk_portfolio_skills_ai_level'
  end

  def down
    # Unassessed rows cannot exist once level/confidence are NOT NULL again.
    # Use raw SQL so the rollback does not depend on app code that may have
    # changed since the migration was written.
    execute <<~SQL.squish
      UPDATE portfolio_skills
         SET ai_level = 1, ai_confidence = 'low', assessed = true
       WHERE assessed = false
    SQL

    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_ai_level'
    add_check_constraint :portfolio_skills,
                         'ai_level >= 1 AND ai_level <= 5',
                         name: 'chk_portfolio_skills_ai_level'

    change_column_null :portfolio_skills, :ai_confidence, false
    change_column_null :portfolio_skills, :ai_level, false
    remove_column :portfolio_skills, :assessed
  end
end
