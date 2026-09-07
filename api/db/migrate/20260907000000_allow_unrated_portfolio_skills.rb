# frozen_string_literal: true

# A skill the interview never reached had no way to be recorded as such.
#
# Portfolios::Generator wrote `skill_data['level'].to_i.clamp(1, 5)`, and when
# the model returns no level for a skill it did not probe, `nil.to_i` is 0 and
# `.clamp(1, 5)` lifts it to 1. Every unprobed skill was therefore stored as
# "L1, Foundational": a real rating, on a real person, invented by a type
# coercion. It is the most expensive kind of defect this product can have,
# because nothing about the result looks wrong.
#
# Making ai_level nullable lets absence be recorded as absence. NULL means the
# interview did not reach this skill; 1 through 5 keep their meaning.
#
# Safe against existing rows: this only relaxes a constraint. Every row already
# holds a value between 1 and 5, so nothing needs backfilling and nothing can
# fail validation on the way in. Reversing it is the operation that could fail,
# so `down` refuses rather than silently discarding data.
class AllowUnratedPortfolioSkills < ActiveRecord::Migration[7.0]
  def up
    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level;
    SQL

    change_column_null :portfolio_skills, :ai_level, true

    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_ai_level
        CHECK (ai_level IS NULL OR (ai_level >= 1 AND ai_level <= 5));
    SQL
  end

  def down
    unrated = select_value(
      'SELECT COUNT(*) FROM ai_interview.portfolio_skills WHERE ai_level IS NULL'
    ).to_i

    if unrated.positive?
      raise ActiveRecord::IrreversibleMigration,
            "#{unrated} portfolio_skills have no level because the interview never reached " \
            'those skills. Rolling back would require inventing a rating for each of them, ' \
            'which is the bug this migration exists to remove. Decide what those rows should ' \
            'say before reversing.'
    end

    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level;
    SQL

    change_column_null :portfolio_skills, :ai_level, false

    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_ai_level
        CHECK (ai_level >= 1 AND ai_level <= 5);
    SQL
  end
end
