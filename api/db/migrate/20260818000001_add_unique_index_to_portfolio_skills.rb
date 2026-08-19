# frozen_string_literal: true

# REL-2: prevent duplicate portfolio skills from concurrent/duplicate generation.
class AddUniqueIndexToPortfolioSkills < ActiveRecord::Migration[7.0]
  def up
    execute 'SET search_path TO ai_interview, public'

    # De-duplicate any existing rows before enforcing uniqueness (keep lowest id).
    execute <<~SQL
      DELETE FROM ai_interview.portfolio_skills a
      USING ai_interview.portfolio_skills b
      WHERE a.id > b.id
        AND a.portfolio_id = b.portfolio_id
        AND a.skill_label = b.skill_label
    SQL

    add_index :portfolio_skills, %i[portfolio_id skill_label],
              unique: true, name: 'idx_portfolio_skills_unique_label'
  end

  def down
    execute 'SET search_path TO ai_interview, public'
    remove_index :portfolio_skills, name: 'idx_portfolio_skills_unique_label'
  end
end
