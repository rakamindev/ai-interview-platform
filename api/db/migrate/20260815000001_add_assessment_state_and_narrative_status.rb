# frozen_string_literal: true

class AddAssessmentStateAndNarrativeStatus < ActiveRecord::Migration[7.0]
  def up
    execute <<-SQL
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fit_gap_narrative_status') THEN
          CREATE TYPE fit_gap_narrative_status AS ENUM ('complete', 'failed', 'skipped');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'portfolio_assessment_state') THEN
          CREATE TYPE portfolio_assessment_state AS ENUM ('assessed', 'insufficient_evidence', 'not_probed');
        END IF;
      END
      $$;
    SQL

    unless column_exists?(:fit_gap_reports, :narrative_status)
      add_column :fit_gap_reports, :narrative_status, :enum, default: 'complete', null: false, enum_type: 'fit_gap_narrative_status'
    end

    unless column_exists?(:portfolio_skills, :assessment_state)
      add_column :portfolio_skills, :assessment_state, :enum, default: 'assessed', null: false, enum_type: 'portfolio_assessment_state'
    end

    unless column_exists?(:portfolio_skills, :superseded_at)
      add_column :portfolio_skills, :superseded_at, :datetime
    end

    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :portfolio_skills, :ai_confidence, true

    unless index_exists?(:portfolio_skills, %i[portfolio_id skill_label], name: 'index_portfolio_skills_on_portfolio_id_and_skill_label')
      add_index :portfolio_skills, %i[portfolio_id skill_label], unique: true, name: 'index_portfolio_skills_on_portfolio_id_and_skill_label'
    end

    execute <<-SQL
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_portfolio_skills_level_matches_state') THEN
          ALTER TABLE portfolio_skills
          ADD CONSTRAINT chk_portfolio_skills_level_matches_state
          CHECK (
            (assessment_state = 'assessed'::portfolio_assessment_state AND ai_level IS NOT NULL AND ai_confidence IS NOT NULL)
            OR
            (assessment_state <> 'assessed'::portfolio_assessment_state AND ai_level IS NULL AND ai_confidence IS NULL)
          );
        END IF;
      END
      $$;
    SQL
  end

  def down
    execute <<-SQL
      ALTER TABLE portfolio_skills DROP CONSTRAINT IF EXISTS chk_portfolio_skills_level_matches_state;
    SQL

    remove_index :portfolio_skills, name: 'index_portfolio_skills_on_portfolio_id_and_skill_label' if index_exists?(:portfolio_skills, %i[portfolio_id skill_label])
    change_column_null :portfolio_skills, :ai_level, false
    change_column_null :portfolio_skills, :ai_confidence, false
    remove_column :portfolio_skills, :superseded_at if column_exists?(:portfolio_skills, :superseded_at)
    remove_column :portfolio_skills, :assessment_state if column_exists?(:portfolio_skills, :assessment_state)
    remove_column :fit_gap_reports, :narrative_status if column_exists?(:fit_gap_reports, :narrative_status)

    execute <<-SQL
      DROP TYPE IF EXISTS portfolio_assessment_state;
      DROP TYPE IF EXISTS fit_gap_narrative_status;
    SQL
  end
end
