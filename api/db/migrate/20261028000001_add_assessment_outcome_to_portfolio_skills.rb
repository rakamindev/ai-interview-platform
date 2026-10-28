# frozen_string_literal: true

# Lets a portfolio say "this skill was not assessed" instead of forcing an
# L1–L5 number onto it.
#
# Before: ai_level NOT NULL CHECK 1..5, so a skill the interview never reached
# was stored as L1 (nil.to_i.clamp(1, 5)) and reported as a "gap".
#
# Safety on existing rows: every existing row holds a real model rating, so it
# is backfilled to assessment_status = 'assessed' through the column default and
# satisfies the new constraint. Only constraints are relaxed; no data is rewritten.
#
# Reversal: `down` restores the old NOT NULL / CHECK constraints. It refuses to
# run while not-assessed rows exist, because the only way to satisfy the old
# schema would be to invent a level for them, which is the defect this migration
# removes.
class AddAssessmentOutcomeToPortfolioSkills < ActiveRecord::Migration[7.0]
  def up
    change_table :portfolio_skills, bulk: true do |t|
      t.string  :assessment_status, limit: 20, null: false, default: 'assessed'
      t.string  :status_reason, limit: 40
      t.string  :coverage_state, limit: 20
      t.integer :probe_count
      t.jsonb   :evidence_refs, null: false, default: []
      t.integer :unverified_evidence_count, null: false, default: 0
    end

    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :portfolio_skills, :ai_confidence, true

    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_ai_level'
    add_check_constraint :portfolio_skills, <<~SQL.squish, name: 'chk_portfolio_skills_outcome'
      (assessment_status = 'assessed' AND ai_level BETWEEN 1 AND 5 AND ai_confidence IS NOT NULL)
      OR (assessment_status = 'not_assessed' AND ai_level IS NULL)
    SQL

    # An assessor may rate a skill the AI could not (e.g. after a follow-up call).
    change_column_null :assessor_overrides, :ai_level, true
    remove_check_constraint :assessor_overrides, name: 'chk_overrides_ai_level'
    add_check_constraint :assessor_overrides, 'ai_level IS NULL OR ai_level BETWEEN 1 AND 5',
                         name: 'chk_overrides_ai_level'

    change_table :portfolios, bulk: true do |t|
      t.datetime :generation_started_at
      t.integer  :generation_attempts, null: false, default: 0
    end
  end

  def down
    blocked = select_value(<<~SQL.squish).to_i
      SELECT (SELECT COUNT(*) FROM portfolio_skills WHERE ai_level IS NULL OR ai_confidence IS NULL)
           + (SELECT COUNT(*) FROM assessor_overrides WHERE ai_level IS NULL)
    SQL
    if blocked.positive?
      raise ActiveRecord::IrreversibleMigration,
            "#{blocked} not-assessed rows exist. Regenerate or delete those portfolios before rolling back; " \
            'the old schema can only hold them by inventing a level.'
    end

    change_table :portfolios, bulk: true do |t|
      t.remove :generation_started_at, :generation_attempts
    end

    remove_check_constraint :assessor_overrides, name: 'chk_overrides_ai_level'
    add_check_constraint :assessor_overrides, 'ai_level BETWEEN 1 AND 5', name: 'chk_overrides_ai_level'
    change_column_null :assessor_overrides, :ai_level, false

    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_outcome'
    add_check_constraint :portfolio_skills, 'ai_level BETWEEN 1 AND 5', name: 'chk_portfolio_skills_ai_level'
    change_column_null :portfolio_skills, :ai_confidence, false
    change_column_null :portfolio_skills, :ai_level, false

    change_table :portfolio_skills, bulk: true do |t|
      t.remove :assessment_status, :status_reason, :coverage_state, :probe_count,
               :evidence_refs, :unverified_evidence_count
    end
  end
end
