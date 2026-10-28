# frozen_string_literal: true

# A portfolio skill is either rated (assessed), was never discussed (not_assessed), or got output
# from the model that could not be trusted (needs_review). Only assessed skills carry a level.
#
# Safe on existing rows: every existing row is a rated skill, so it gets the default 'assessed'
# and already satisfies the new constraints. Adding a column with a constant default and dropping
# NOT NULL are metadata-only changes in PostgreSQL 11+; the check constraints scan the table once.
#
# A string column with a CHECK constraint is used instead of a PostgreSQL enum: adding a value to
# an enum later cannot be rolled back inside a transaction.
class AddAssessmentStatusToPortfolioSkills < ActiveRecord::Migration[7.0]
  STATUSES = %w[assessed not_assessed needs_review].freeze

  def up
    add_column :portfolio_skills, :assessment_status, :string, limit: 20, null: false, default: 'assessed'
    add_column :portfolio_skills, :status_reason, :string, limit: 255

    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :portfolio_skills, :ai_confidence, true
    change_column_default :portfolio_skills, :competency_summary, from: nil, to: ''

    add_check_constraint :portfolio_skills,
                         "assessment_status IN (#{STATUSES.map { |s| "'#{s}'" }.join(', ')})",
                         name: 'chk_portfolio_skills_assessment_status'
    # A level exists exactly when the skill was rated.
    add_check_constraint :portfolio_skills,
                         "(assessment_status = 'assessed') = (ai_level IS NOT NULL)",
                         name: 'chk_portfolio_skills_level_iff_assessed'
    # A rated skill always has a confidence; a skill nobody discussed never does.
    add_check_constraint :portfolio_skills,
                         "(assessment_status <> 'assessed' OR ai_confidence IS NOT NULL) AND " \
                         "(assessment_status <> 'not_assessed' OR ai_confidence IS NULL)",
                         name: 'chk_portfolio_skills_confidence_by_status'
  end

  def down
    unrated = select_value("SELECT COUNT(*) FROM portfolio_skills WHERE ai_level IS NULL OR ai_confidence IS NULL").to_i
    if unrated.positive?
      # Restoring NOT NULL would mean inventing a level for skills the interview never measured.
      raise ActiveRecord::IrreversibleMigration,
            "#{unrated} portfolio skill(s) have no level or confidence. Regenerate or delete them " \
            'before rolling back; this migration will not invent ratings.'
    end

    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_confidence_by_status'
    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_level_iff_assessed'
    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_assessment_status'

    change_column_default :portfolio_skills, :competency_summary, from: '', to: nil
    change_column_null :portfolio_skills, :ai_confidence, false
    change_column_null :portfolio_skills, :ai_level, false

    remove_column :portfolio_skills, :status_reason
    remove_column :portfolio_skills, :assessment_status
  end
end
