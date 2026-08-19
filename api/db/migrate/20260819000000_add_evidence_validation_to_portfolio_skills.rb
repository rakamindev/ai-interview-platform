# frozen_string_literal: true

class AddEvidenceValidationToPortfolioSkills < ActiveRecord::Migration[7.0]
  def up
    execute <<~SQL
      DO $$ BEGIN
        CREATE TYPE ai_interview.portfolio_assessment_state AS ENUM ('assessed', 'not_assessed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    SQL

    add_column :portfolio_skills, :assessment_state,
               'ai_interview.portfolio_assessment_state', null: false, default: 'assessed'
    add_column :portfolio_skills, :evidence_turn_ids, :jsonb, null: false, default: []

    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :portfolio_skills, :ai_confidence, true

    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_assessment_state
        CHECK (
          (assessment_state = 'assessed' AND ai_level IS NOT NULL AND ai_confidence IS NOT NULL) OR
          (assessment_state = 'not_assessed' AND ai_level IS NULL AND ai_confidence IS NULL AND evidence = '[]'::jsonb AND evidence_turn_ids = '[]'::jsonb)
        );
    SQL
  end

  def down
    execute 'ALTER TABLE ai_interview.portfolio_skills DROP CONSTRAINT chk_portfolio_skills_assessment_state'
    change_column_null :portfolio_skills, :ai_confidence, false
    change_column_null :portfolio_skills, :ai_level, false

    remove_column :portfolio_skills, :evidence_turn_ids
    remove_column :portfolio_skills, :assessment_state
    execute 'DROP TYPE IF EXISTS ai_interview.portfolio_assessment_state'
  end
end
