# frozen_string_literal: true

# portfolio_skills.ai_level is NOT NULL with CHECK (ai_level BETWEEN 1 AND 5),
# so the schema has no way to say "this skill was discussed but the evidence
# did not support any level". Portfolios::Generator therefore coerced every
# missing or non-numeric model output through `.to_i.clamp(1, 5)`, which turns
# nil into 1 — the anchor that reads "cannot apply independently".
#
# Absence of evidence was being recorded as evidence of incompetence, against
# a real candidate, permanently. This migration makes the absent case
# representable so the application can stop inventing a rating.
#
# NULL and CHECK: in PostgreSQL a CHECK constraint evaluates to UNKNOWN when
# an operand is NULL, and rows pass unless the result is FALSE. The existing
# chk_portfolio_skills_ai_level constraint therefore continues to admit
# NULL without modification, and still rejects 0 or 6.
class AllowUnratedPortfolioSkills < ActiveRecord::Migration[7.0]
  def up
    change_column_null :portfolio_skills, :ai_level, true
  end

  # Deliberately not silently reversible.
  #
  # Restoring NOT NULL requires a value for every unrated row, and the only
  # value the old schema could hold is the one that caused the defect. Picking
  # it here would quietly re-harm the affected candidates during what an
  # operator believes is a neutral rollback. If unrated rows exist, the call
  # is theirs to make explicitly.
  def down
    unrated = select_value('SELECT COUNT(*) FROM ai_interview.portfolio_skills WHERE ai_level IS NULL').to_i

    if unrated.positive?
      raise ActiveRecord::IrreversibleMigration, <<~MSG
        #{unrated} portfolio_skills row(s) have ai_level IS NULL and cannot be
        expressed under the previous NOT NULL schema.

        Rolling back means choosing what those unrated skills become. Decide
        explicitly, then re-run this rollback. For example, to drop them:

          DELETE FROM ai_interview.portfolio_skills WHERE ai_level IS NULL;

        Do not backfill them to 1 — that is the defect this migration removed.
      MSG
    end

    change_column_null :portfolio_skills, :ai_level, false
  end
end
