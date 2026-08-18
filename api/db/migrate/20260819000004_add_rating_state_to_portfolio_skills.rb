# frozen_string_literal: true

# Distinguishes an unrated skill from a level-1 rating.
# ai_level becomes nullable; a rating_state enum tracks whether the skill
# has been rated by the model or is genuinely unrated.
#
# The rollback deletes unrated rows and logs the count rather than writing
# 1 into them — inventing a rating during the rollback of the migration
# that fixes invented ratings would be absurd.
class AddRatingStateToPortfolioSkills < ActiveRecord::Migration[7.0]
  disable_ddl_transaction!

  def up
    # Step 1: Create the enum type
    execute <<~SQL.squish
      DO $$ BEGIN
        CREATE TYPE ai_interview.rating_state AS ENUM ('rated', 'unrated');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    SQL

    # Step 2: Add the column with default 'rated'
    add_column :portfolio_skills, :rating_state,
               'ai_interview.rating_state', default: 'rated', null: false

    # Step 3: Relax ai_level NOT NULL
    change_column_null :portfolio_skills, :ai_level, true

    # Step 4: Remove the CHECK constraint that enforced ai_level BETWEEN 1 AND 5
    # (NULL is valid now, and the CHECK prevents NULL)
    execute <<~SQL.squish
      ALTER TABLE ai_interview.portfolio_skills
        DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level
    SQL

    # Step 5: Add a new CHECK that allows NULL
    execute <<~SQL.squish
      ALTER TABLE ai_interview.portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_ai_level
        CHECK (ai_level IS NULL OR (ai_level BETWEEN 1 AND 5))
    SQL
  end

  def down
    # Lossy rollback: delete unrated rows and log the count
    unrated_count = connection.select_value(<<~SQL.squish)
      SELECT COUNT(*) FROM ai_interview.portfolio_skills
      WHERE rating_state = 'unrated'
    SQL

    if unrated_count > 0
      say_with_time "DELETING #{unrated_count} unrated portfolio_skills rows (lossy rollback)" do
        execute <<~SQL.squish
          DELETE FROM ai_interview.portfolio_skills
          WHERE rating_state = 'unrated'
        SQL
      end
      warn "WARNING: #{unrated_count} unrated portfolio_skills rows were deleted during rollback"
    end

    # Relax constraint back to strict
    execute <<~SQL.squish
      ALTER TABLE ai_interview.portfolio_skills
        DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level
    SQL

    execute <<~SQL.squish
      ALTER TABLE ai_interview.portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_ai_level
        CHECK (ai_level BETWEEN 1 AND 5)
    SQL

    # Restore NOT NULL
    change_column_null :portfolio_skills, :ai_level, false

    # Drop column and enum
    remove_column :portfolio_skills, :rating_state
    execute "DROP TYPE IF EXISTS ai_interview.rating_state"
  end
end
