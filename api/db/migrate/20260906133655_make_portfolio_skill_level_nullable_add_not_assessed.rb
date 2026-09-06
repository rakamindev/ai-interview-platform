# frozen_string_literal: true

class MakePortfolioSkillLevelNullableAddNotAssessed < ActiveRecord::Migration[7.0]
  def up
    execute 'SET search_path TO ai_interview, public'

    # ai_level sudah ada sebagai integer NOT NULL — buat nullable
    change_column_null :portfolio_skills, :ai_level, true

    # ai_confidence dibuat nullable ketika skill not_assessed
    change_column_null :portfolio_skills, :ai_confidence, true

    # Tambah not_assessed boolean, default false
    add_column :portfolio_skills, :not_assessed, :boolean, default: false, null: false

    # Update DB check constraint untuk allow NULL ai_level
    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_ai_level'
    add_check_constraint :portfolio_skills,
                         'ai_level IS NULL OR (ai_level >= 1 AND ai_level <= 5)',
                         name: 'chk_portfolio_skills_ai_level'
  end

  def down
    execute 'SET search_path TO ai_interview, public'

    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_ai_level'
    add_check_constraint :portfolio_skills,
                         'ai_level >= 1 AND ai_level <= 5',
                         name: 'chk_portfolio_skills_ai_level'

    remove_column :portfolio_skills, :not_assessed

    execute "UPDATE portfolio_skills SET ai_confidence = 'low' WHERE ai_confidence IS NULL"
    change_column_null :portfolio_skills, :ai_confidence, false

    execute 'UPDATE portfolio_skills SET ai_level = 1 WHERE ai_level IS NULL'
    change_column_null :portfolio_skills, :ai_level, false
  end
end
