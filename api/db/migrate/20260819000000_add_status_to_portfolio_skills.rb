# frozen_string_literal: true

class AddStatusToPortfolioSkills < ActiveRecord::Migration[7.0]
  def up
    execute "SET search_path TO ai_interview, public"

    execute <<~SQL
      DO $$ BEGIN
        CREATE TYPE ai_interview.portfolio_skill_status AS ENUM ('rated', 'not_assessed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    SQL

    add_column :portfolio_skills, :status, :portfolio_skill_status, null: false, default: 'rated'

    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :portfolio_skills, :ai_confidence, true
    change_column_null :portfolio_skills, :competency_summary, true

    remove_check_constraint :portfolio_skills, name: "chk_portfolio_skills_ai_level"
    add_check_constraint :portfolio_skills,
                          "ai_level IS NULL OR (ai_level >= 1 AND ai_level <= 5)",
                          name: "chk_portfolio_skills_ai_level"
  end

  def down
    execute "SET search_path TO ai_interview, public"

    execute <<~SQL
      UPDATE portfolio_skills
      SET ai_level = 1, ai_confidence = 'low', competency_summary = 'Not assessed.'
      WHERE ai_level IS NULL OR ai_confidence IS NULL OR competency_summary IS NULL
    SQL

    remove_check_constraint :portfolio_skills, name: "chk_portfolio_skills_ai_level"
    add_check_constraint :portfolio_skills, "ai_level >= 1 AND ai_level <= 5",
                          name: "chk_portfolio_skills_ai_level"

    change_column_null :portfolio_skills, :ai_level, false
    change_column_null :portfolio_skills, :ai_confidence, false
    change_column_null :portfolio_skills, :competency_summary, false

    remove_column :portfolio_skills, :status

    execute "DROP TYPE IF EXISTS ai_interview.portfolio_skill_status"
  end
end
