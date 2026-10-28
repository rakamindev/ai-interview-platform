# frozen_string_literal: true

# Adds an explicit per-skill assessment status so a skill the interview never
# reached (not_yet / insufficient evidence) can no longer be silently forced
# into a fabricated level and reported as a "gap" downstream. See
# assessment/step-4-revamp-strategy.md (AC-1 through AC-7, AC-17 through
# AC-19) for the full rationale and acceptance criteria.
#
# Safety:
#   - Backfills existing rows from data already on the row (confidence,
#     evidence) plus the session's coverage_maps, before adding the NOT NULL
#     constraint — no row is left in an invalid state at any point.
#   - ai_level becomes nullable (a not_assessed skill carries no level), with
#     a CHECK tying nullability to the new status column, so the two can't
#     drift apart.
#   - `down` refuses to run if any row would violate the restored NOT NULL on
#     ai_level, rather than destroying data or guessing a level.
class AddAssessmentStatusToPortfolioSkills < ActiveRecord::Migration[7.0]
  def up
    execute <<~SQL
      DO $$ BEGIN
        CREATE TYPE ai_interview.assessment_status AS ENUM
          ('assessed', 'insufficient_evidence', 'not_assessed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    SQL

    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        ADD COLUMN assessment_status ai_interview.assessment_status;
    SQL

    # Backfill order mirrors Portfolios::SkillStatus.derive (app/services/
    # portfolios/skill_status.rb): coverage state decides not_assessed first;
    # only then do confidence/evidence decide insufficient_evidence.
    # is_discovered is matched on both sides so a configured and a discovered
    # skill that happen to share a label can't cross-match each other's
    # coverage row.
    # Postgres UPDATE...FROM cannot reference the target table (ps) anywhere
    # in its FROM clause, including inside a LATERAL join item — the target
    # row is only visible to a correlated subquery, so the whole lookup is
    # one scalar subquery in the SET clause instead of a FROM/JOIN.
    execute <<~SQL
      UPDATE ai_interview.portfolio_skills ps
      SET assessment_status = (
        SELECT (CASE
          WHEN cm.state IS NULL OR cm.state = 'not_yet' THEN 'not_assessed'
          WHEN ps.ai_confidence = 'low' OR jsonb_array_length(ps.evidence) = 0 THEN 'insufficient_evidence'
          ELSE 'assessed'
        END)::ai_interview.assessment_status
        FROM ai_interview.portfolios p
        JOIN ai_interview.sessions s ON s.id = p.session_id
        LEFT JOIN ai_interview.coverage_maps cm
          ON cm.session_id = s.id
          AND cm.is_discovered = ps.is_discovered
          AND (
            (ps.skill_id IS NOT NULL AND cm.skill_id = ps.skill_id)
            OR (ps.skill_id IS NULL AND lower(cm.skill_label) = lower(ps.skill_label))
          )
        WHERE p.id = ps.portfolio_id
        LIMIT 1
      );
    SQL

    # A discovered skill always has at least weak evidence by construction
    # (it wouldn't exist in portfolio_skills otherwise) — never not_assessed.
    execute <<~SQL
      UPDATE ai_interview.portfolio_skills
      SET assessment_status = 'insufficient_evidence'
      WHERE is_discovered = true AND assessment_status = 'not_assessed';
    SQL

    # Relax the NOT NULL on ai_level before nulling any row out, or the
    # UPDATE below violates the still-active original constraint.
    change_column_null :portfolio_skills, :ai_level, true

    # A not_assessed skill carries no fabricated level.
    execute <<~SQL
      UPDATE ai_interview.portfolio_skills
      SET ai_level = NULL
      WHERE assessment_status = 'not_assessed';
    SQL

    change_column_null :portfolio_skills, :assessment_status, false

    # Not a strict biconditional: not_assessed never has a level, assessed
    # always does, but insufficient_evidence can go either way — it covers
    # both "coverage was weak" (a provisional level is kept) and "the LLM's
    # level couldn't be parsed at all even though coverage existed" (no
    # level to keep). See Portfolios::SkillStatus#derive.
    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_status_level_consistency
        CHECK (
          (assessment_status <> 'not_assessed' OR ai_level IS NULL)
          AND (assessment_status <> 'assessed' OR ai_level IS NOT NULL)
        );
    SQL
  end

  def down
    not_assessed_count = select_value(<<~SQL).to_i
      SELECT COUNT(*) FROM ai_interview.portfolio_skills WHERE assessment_status = 'not_assessed'
    SQL

    if not_assessed_count.positive?
      raise ActiveRecord::IrreversibleMigration,
            "#{not_assessed_count} portfolio_skills row(s) have assessment_status " \
            "'not_assessed' with ai_level NULL. Restoring the NOT NULL constraint on " \
            "ai_level would require fabricating a level for them, which is exactly what " \
            "this migration exists to stop doing. Set ai_level manually on those rows " \
            "first if you intend to revert anyway."
    end

    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        DROP CONSTRAINT chk_portfolio_skills_status_level_consistency;
    SQL
    change_column_null :portfolio_skills, :ai_level, false
    remove_column :portfolio_skills, :assessment_status
    execute "DROP TYPE IF EXISTS ai_interview.assessment_status"
  end
end
