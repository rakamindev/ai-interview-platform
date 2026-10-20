# frozen_string_literal: true

class AddAssessmentStatusToPortfolioSkills < ActiveRecord::Migration[7.0]
  def up
    add_column :portfolio_skills, :assessment_status, :string, limit: 30, null: false, default: 'assessed'

    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :portfolio_skills, :ai_confidence, true
    change_column_null :portfolio_skills, :competency_summary, true

    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_ai_level'

    add_check_constraint :portfolio_skills,
                         "assessment_status IN ('assessed', 'insufficient_evidence', 'not_assessed')",
                         name: 'chk_portfolio_skills_assessment_status'

    add_check_constraint :portfolio_skills,
                         "(assessment_status = 'assessed' AND ai_level IS NOT NULL AND ai_level BETWEEN 1 AND 5) OR " \
                         "(assessment_status <> 'assessed' AND ai_level IS NULL)",
                         name: 'chk_portfolio_skills_level_matches_status'
  end

  def down
    unassessed = select_value("SELECT COUNT(*) FROM portfolio_skills WHERE assessment_status <> 'assessed'").to_i
    if unassessed.positive?
      raise ActiveRecord::IrreversibleMigration,
            "#{unassessed} portfolio skills have no AI level. Rolling back would need a fake level for them. " \
            'Regenerate or delete those portfolios first.'
    end

    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_level_matches_status'
    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_assessment_status'

    add_check_constraint :portfolio_skills, 'ai_level >= 1 AND ai_level <= 5', name: 'chk_portfolio_skills_ai_level'

    change_column_null :portfolio_skills, :competency_summary, false
    change_column_null :portfolio_skills, :ai_confidence, false
    change_column_null :portfolio_skills, :ai_level, false

    remove_column :portfolio_skills, :assessment_status
  end
end
