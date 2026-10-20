# frozen_string_literal: true

# Lets a skill be recorded as "not assessed" instead of a fabricated L1, and lets a
# fit/gap report record whether its evidence is sufficient to support a recommendation.
#
# up: only relaxes constraints and adds nullable/defaulted columns — safe on existing rows,
#     no table rewrite or backfill.
# down: lossy by design — not-assessed ratings are backfilled to the old forced values
#       (L1 / low) so the original NOT NULL constraints can be restored.
class AllowNotAssessedSkillRatings < ActiveRecord::Migration[7.0]
  def up
    execute <<~SQL
      ALTER TABLE portfolio_skills
        ALTER COLUMN ai_level DROP NOT NULL,
        ALTER COLUMN ai_confidence DROP NOT NULL,
        ALTER COLUMN competency_summary DROP NOT NULL,
        DROP CONSTRAINT chk_portfolio_skills_ai_level,
        ADD CONSTRAINT chk_portfolio_skills_ai_level
          CHECK (ai_level IS NULL OR (ai_level >= 1 AND ai_level <= 5)),
        ADD CONSTRAINT chk_portfolio_skills_rating_complete
          CHECK ((ai_level IS NULL) = (ai_confidence IS NULL));

      ALTER TABLE assessor_overrides
        ALTER COLUMN ai_level DROP NOT NULL,
        DROP CONSTRAINT chk_overrides_ai_level,
        ADD CONSTRAINT chk_overrides_ai_level
          CHECK (ai_level IS NULL OR (ai_level >= 1 AND ai_level <= 5));

      ALTER TABLE fit_gap_reports
        ADD COLUMN recommendation_status varchar(32),
        ADD COLUMN evidence_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD CONSTRAINT chk_fit_gap_reports_recommendation_status
          CHECK (recommendation_status IS NULL
                 OR recommendation_status IN ('sufficient', 'insufficient_evidence'));
    SQL
  end

  def down
    execute <<~SQL
      ALTER TABLE fit_gap_reports
        DROP CONSTRAINT chk_fit_gap_reports_recommendation_status,
        DROP COLUMN evidence_gaps,
        DROP COLUMN recommendation_status;

      UPDATE assessor_overrides SET ai_level = 1 WHERE ai_level IS NULL;
      ALTER TABLE assessor_overrides
        DROP CONSTRAINT chk_overrides_ai_level,
        ADD CONSTRAINT chk_overrides_ai_level CHECK (ai_level >= 1 AND ai_level <= 5),
        ALTER COLUMN ai_level SET NOT NULL;

      -- Drop the both-or-neither rule first: the backfill sets level and confidence in separate steps.
      ALTER TABLE portfolio_skills DROP CONSTRAINT chk_portfolio_skills_rating_complete;
      UPDATE portfolio_skills SET ai_level = 1 WHERE ai_level IS NULL;
      UPDATE portfolio_skills SET ai_confidence = 'low' WHERE ai_confidence IS NULL;
      UPDATE portfolio_skills SET competency_summary = '' WHERE competency_summary IS NULL;
      ALTER TABLE portfolio_skills
        DROP CONSTRAINT chk_portfolio_skills_ai_level,
        ADD CONSTRAINT chk_portfolio_skills_ai_level CHECK (ai_level >= 1 AND ai_level <= 5),
        ALTER COLUMN ai_level SET NOT NULL,
        ALTER COLUMN ai_confidence SET NOT NULL,
        ALTER COLUMN competency_summary SET NOT NULL;
    SQL
  end
end
