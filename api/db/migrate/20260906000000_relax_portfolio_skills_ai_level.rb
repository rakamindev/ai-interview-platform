# frozen_string_literal: true

# A missing AI level must be storable as NULL — the frontend (LevelBadge,
# parseLevel) already renders "Unknown" for it. Storing NOT NULL forced the
# generator to fabricate a level, and its fallback was the WORST rating (L1).
#
# Reversibility note (down): restoring NOT NULL must not run while NULL rows
# exist. Rather than silently backfilling them to a level — which would
# recreate the fabrication this migration exists to remove — the down migration
# refuses with an explicit message until the rows are resolved by hand.
class RelaxPortfolioSkillsAiLevel < ActiveRecord::Migration[7.0]
  def up
    change_column_null :portfolio_skills, :ai_level, true

    # Widen the check to accept NULL while still rejecting out-of-range values.
    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_ai_level'
    add_check_constraint :portfolio_skills,
                         'ai_level IS NULL OR (ai_level >= 1 AND ai_level <= 5)',
                         name: 'chk_portfolio_skills_ai_level'
  end

  def down
    if execute('SELECT 1 FROM portfolio_skills WHERE ai_level IS NULL LIMIT 1').any?
      raise 'Cannot revert relax_portfolio_skills_ai_level: NULL ai_level rows exist. ' \
            'Resolve them first — do not backfill invented levels.'
    end

    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_ai_level'
    add_check_constraint :portfolio_skills,
                         'ai_level >= 1 AND ai_level <= 5',
                         name: 'chk_portfolio_skills_ai_level'
    change_column_null :portfolio_skills, :ai_level, false
  end
end
