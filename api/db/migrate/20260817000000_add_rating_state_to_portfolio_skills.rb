# frozen_string_literal: true

class AddRatingStateToPortfolioSkills < ActiveRecord::Migration[7.0]
  CONSISTENCY_CONSTRAINT = 'chk_portfolio_skills_rating_consistency'

  def up
    create_enum :rating_status, %w[rated unrated]
    create_enum :unrated_reason, %w[absent malformed out_of_range no_evidence]

    add_column :portfolio_skills, :rating_status, :enum,
               enum_type: :rating_status, null: false, default: 'rated'
    add_column :portfolio_skills, :unrated_reason, :enum, enum_type: :unrated_reason
    add_index :portfolio_skills, :rating_status

    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :portfolio_skills, :ai_confidence, true
    change_column_null :portfolio_skills, :competency_summary, true
    change_column_null :assessor_overrides, :ai_level, true

    add_check_constraint :portfolio_skills,
                         <<~SQL.squish,
                           (
                             (rating_status = 'rated' AND ai_level IS NOT NULL AND unrated_reason IS NULL)
                             OR
                             (rating_status = 'unrated' AND ai_level IS NULL AND unrated_reason IS NOT NULL)
                           )
                         SQL
                         name: CONSISTENCY_CONSTRAINT
  end

  def down
    if execute("SELECT 1 FROM portfolio_skills WHERE rating_status = 'unrated' LIMIT 1").any?
      raise ActiveRecord::IrreversibleMigration,
            'Cannot remove rating state while unrated portfolio skills exist.'
    end

    remove_check_constraint :portfolio_skills, name: CONSISTENCY_CONSTRAINT
    change_column_null :assessor_overrides, :ai_level, false
    change_column_null :portfolio_skills, :competency_summary, false
    change_column_null :portfolio_skills, :ai_confidence, false
    change_column_null :portfolio_skills, :ai_level, false
    remove_index :portfolio_skills, :rating_status
    remove_column :portfolio_skills, :unrated_reason
    remove_column :portfolio_skills, :rating_status
    execute 'DROP TYPE unrated_reason'
    execute 'DROP TYPE rating_status'
  end
end
