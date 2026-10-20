# frozen_string_literal: true

class P0PortfolioSkillsAndOverrides < ActiveRecord::Migration[7.0]
  def up
    # 1. Create enum for assessment_status in ai_interview schema
    execute <<~SQL
      DO $$ BEGIN
        CREATE TYPE ai_interview.assessment_status AS ENUM ('assessed', 'insufficient_evidence', 'not_assessed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    SQL

    # 2. Add columns to portfolio_skills
    add_column :portfolio_skills, :assessment_status, 'ai_interview.assessment_status', default: 'assessed', null: false
    add_column :portfolio_skills, :status_reason, :string, limit: 50
    add_column :portfolio_skills, :legacy_ai_level, :integer

    # 3. Add columns to fit_gap_reports (AC-D6 support for narrative status)
    add_column :fit_gap_reports, :narrative_status, :string, limit: 20, default: 'generated'
    add_column :fit_gap_reports, :source_fingerprint, :string, limit: 64

    # 4. Relax NOT NULL constraints on portfolio_skills
    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :portfolio_skills, :ai_confidence, true
    change_column_null :portfolio_skills, :competency_summary, true

    # 5. Relax NOT NULL constraint on assessor_overrides.ai_level
    change_column_null :assessor_overrides, :ai_level, true

    # 6. Drop old check constraints
    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level;

      ALTER TABLE ai_interview.assessor_overrides
        DROP CONSTRAINT IF EXISTS chk_overrides_ai_level;
    SQL

    # 7. Add new check constraints for portfolio_skills
    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_status_and_level
        CHECK (
          (assessment_status = 'not_assessed' AND ai_level IS NULL)
          OR
          (assessment_status IN ('assessed', 'insufficient_evidence') AND ai_level BETWEEN 1 AND 5)
        );

      ALTER TABLE ai_interview.portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_confidence
        CHECK (
          (assessment_status = 'not_assessed')
          OR
          (assessment_status IN ('assessed', 'insufficient_evidence') AND ai_confidence IS NOT NULL)
        );

      ALTER TABLE ai_interview.portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_summary
        CHECK (
          (assessment_status = 'not_assessed')
          OR
          (assessment_status IN ('assessed', 'insufficient_evidence') AND competency_summary IS NOT NULL)
        );

      ALTER TABLE ai_interview.portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_status_reason
        CHECK (
          status_reason IS NULL OR status_reason IN ('not_covered', 'no_valid_evidence', 'missing_from_model_output', 'invalid_model_output')
        );

      ALTER TABLE ai_interview.assessor_overrides
        ADD CONSTRAINT chk_overrides_ai_level
        CHECK (ai_level IS NULL OR (ai_level BETWEEN 1 AND 5));
    SQL

    # 8. Reclassify existing portfolio_skills (AC-D4)
    # Reclassify using coverage_maps of the session
    execute <<~SQL
      DO $$
      DECLARE
        r RECORD;
        cm RECORD;
        new_status ai_interview.assessment_status;
        new_reason text;
        orig_level integer;
      BEGIN
        FOR r IN (
          SELECT ps.id, ps.portfolio_id, ps.skill_id, ps.skill_label, ps.ai_level, p.session_id
          FROM ai_interview.portfolio_skills ps
          JOIN ai_interview.portfolios p ON p.id = ps.portfolio_id
        ) LOOP
          -- Find matching coverage map
          SELECT * INTO cm
          FROM ai_interview.coverage_maps
          WHERE session_id = r.session_id
            AND (
              (skill_id IS NOT NULL AND skill_id = r.skill_id)
              OR LOWER(skill_label) = LOWER(r.skill_label)
            )
          LIMIT 1;

          orig_level := r.ai_level;

          IF cm IS NULL OR cm.state = 'not_yet' OR cm.probe_count = 0 THEN
            new_status := 'not_assessed';
            new_reason := 'not_covered';

            UPDATE ai_interview.portfolio_skills
            SET assessment_status = new_status,
                status_reason = new_reason,
                legacy_ai_level = orig_level,
                ai_level = NULL,
                ai_confidence = NULL,
                competency_summary = COALESCE(competency_summary, 'This skill was not evaluated during the session.')
            WHERE id = r.id;
          ELSIF cm.state = 'initiated' OR cm.probe_count < 2 THEN
            new_status := 'insufficient_evidence';
            new_reason := NULL;

            UPDATE ai_interview.portfolio_skills
            SET assessment_status = new_status,
                status_reason = new_reason,
                ai_confidence = 'low'
            WHERE id = r.id;
          ELSE
            new_status := 'assessed';
            new_reason := NULL;

            UPDATE ai_interview.portfolio_skills
            SET assessment_status = new_status,
                status_reason = new_reason
            WHERE id = r.id;
          END IF;
        END LOOP;
      END $$;
    SQL
  end

  def down
    # 1. Drop new constraints first so we can restore values
    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        DROP CONSTRAINT IF EXISTS chk_portfolio_skills_status_and_level;

      ALTER TABLE ai_interview.portfolio_skills
        DROP CONSTRAINT IF EXISTS chk_portfolio_skills_confidence;

      ALTER TABLE ai_interview.portfolio_skills
        DROP CONSTRAINT IF EXISTS chk_portfolio_skills_summary;

      ALTER TABLE ai_interview.portfolio_skills
        DROP CONSTRAINT IF EXISTS chk_portfolio_skills_status_reason;

      ALTER TABLE ai_interview.assessor_overrides
        DROP CONSTRAINT IF EXISTS chk_overrides_ai_level;
    SQL

    # 2. Restore data for portfolio_skills and assessor_overrides (AC-D5)
    execute <<~SQL
      UPDATE ai_interview.portfolio_skills
      SET ai_level = COALESCE(legacy_ai_level, 1),
          ai_confidence = COALESCE(ai_confidence, 'low'::ai_interview.confidence_level),
          competency_summary = COALESCE(competency_summary, 'Not assessed')
      WHERE assessment_status = 'not_assessed';

      UPDATE ai_interview.assessor_overrides
      SET ai_level = 1
      WHERE ai_level IS NULL;
    SQL

    # 3. Restore old constraints and NOT NULL
    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_ai_level
        CHECK (ai_level BETWEEN 1 AND 5);

      ALTER TABLE ai_interview.assessor_overrides
        ADD CONSTRAINT chk_overrides_ai_level
        CHECK (ai_level BETWEEN 1 AND 5);
    SQL

    change_column_null :portfolio_skills, :ai_level, false
    change_column_null :portfolio_skills, :ai_confidence, false
    change_column_null :portfolio_skills, :competency_summary, false
    change_column_null :assessor_overrides, :ai_level, false

    # 4. Remove added columns
    remove_column :portfolio_skills, :legacy_ai_level
    remove_column :portfolio_skills, :status_reason
    remove_column :portfolio_skills, :assessment_status

    remove_column :fit_gap_reports, :source_fingerprint
    remove_column :fit_gap_reports, :narrative_status

    # 5. Drop enum type
    execute "DROP TYPE IF EXISTS ai_interview.assessment_status CASCADE;"
  end
end
