# frozen_string_literal: true

class AddHonestAssessmentToPortfolioSkills < ActiveRecord::Migration[7.0]
  def up
    create_enum :portfolio_assessment_status, %w[assessed not_assessed]

    add_column :portfolio_skills, :assessment_status, :enum,
               enum_type: :portfolio_assessment_status, null: false, default: 'assessed'
    add_column :portfolio_skills, :coverage_state, :enum,
               enum_type: :coverage_state, null: true
    add_column :portfolio_skills, :probe_count, :integer, null: true

    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :portfolio_skills, :ai_confidence, true

    execute 'ALTER TABLE portfolio_skills DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level'
    execute 'ALTER TABLE portfolio_skills ADD CONSTRAINT chk_portfolio_skills_ai_level ' \
            'CHECK (ai_level IS NULL OR (ai_level >= 1 AND ai_level <= 5))'

    execute "UPDATE portfolio_skills SET assessment_status = 'assessed' WHERE assessment_status IS NULL"
  end

  def down
    execute 'UPDATE portfolio_skills SET ai_level = 1 WHERE ai_level IS NULL'
    execute "UPDATE portfolio_skills SET ai_confidence = 'low' WHERE ai_confidence IS NULL"
    execute "UPDATE portfolio_skills SET assessment_status = 'assessed'"

    remove_column :portfolio_skills, :probe_count
    remove_column :portfolio_skills, :coverage_state
    remove_column :portfolio_skills, :assessment_status

    execute 'DROP TYPE portfolio_assessment_status'

    change_column_null :portfolio_skills, :ai_level, false
    change_column_null :portfolio_skills, :ai_confidence, false

    execute 'ALTER TABLE portfolio_skills DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level'
    execute 'ALTER TABLE portfolio_skills ADD CONSTRAINT chk_portfolio_skills_ai_level ' \
            'CHECK (ai_level >= 1 AND ai_level <= 5)'
  end
end
