# frozen_string_literal: true

# A configured skill the interview never reached used to be stored with a
# fabricated level (nil.to_i.clamp(1, 5) == 1). This lets a skill exist in the
# portfolio without a level, and records why.
#
# Safe on existing rows: every existing row has a level, so the default
# 'rated' is true for all of them and both check constraints hold.
class AddRatingStatusToPortfolioSkills < ActiveRecord::Migration[7.0]
  def up
    add_column :portfolio_skills, :rating_status, :string, limit: 30, null: false, default: 'rated'
    add_column :portfolio_skills, :probe_count, :integer
    add_column :portfolio_skills, :coverage_state, :string, limit: 20

    change_column_null :portfolio_skills, :ai_level, true

    add_check_constraint :portfolio_skills,
                         "rating_status IN ('rated', 'not_assessed', 'insufficient_evidence')",
                         name: 'chk_portfolio_skills_rating_status'
    add_check_constraint :portfolio_skills,
                         "(rating_status = 'rated') = (ai_level IS NOT NULL)",
                         name: 'chk_portfolio_skills_level_matches_status'
  end

  def down
    unrated = select_value("SELECT COUNT(*) FROM portfolio_skills WHERE ai_level IS NULL").to_i
    if unrated.positive?
      raise ActiveRecord::IrreversibleMigration,
            "#{unrated} portfolio skills have no level. The old schema would need a fake " \
            "level for them. Regenerate or delete those portfolios before rolling back."
    end

    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_level_matches_status'
    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_rating_status'
    change_column_null :portfolio_skills, :ai_level, false
    remove_column :portfolio_skills, :coverage_state
    remove_column :portfolio_skills, :probe_count
    remove_column :portfolio_skills, :rating_status
  end
end
