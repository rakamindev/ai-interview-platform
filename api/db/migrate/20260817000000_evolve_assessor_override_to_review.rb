# frozen_string_literal: true

# Evolves the assessor override concept into a full review workflow.
#
# Backward compatible: the existing `assessor_overrides` table keeps its
# columns (ai_level, override_level, assessor_notes, overridden_by,
# overridden_at) and gains:
#   - `outcome`          — confirmed | adjusted | insufficient_evidence
#   - `reviewed_level`   — nullable (NULL = not assessed / insufficient evidence)
#   - `reviewed_by`      — reviewer user id (backfilled from overridden_by)
#   - `reviewed_at`      — review timestamp (backfilled from overridden_at)
#   - `rationale`        — required for adjusted / insufficient_evidence
#
# Existing overrides are backfilled as `outcome = 'adjusted'` using their
# override_level as reviewed_level. The `ai_level` snapshot is already stored.
#
# Also relaxes `portfolio_skills` so an AI evaluation may have NO numeric level
# (invalid/missing model output → visible "not assessed", never silently L1):
#   - `ai_level` becomes nullable (check constraint updated to allow NULL)
#   - adds `evidence_provenance` jsonb for transcript verification metadata
#
# And adds `tenant_id` to `portfolios` (already present via direct ALTER in some
# environments; this makes it explicit + indexed for tenant-scoped lookups).
class EvolveAssessorOverrideToReview < ActiveRecord::Migration[7.0]
  def up
    add_review_columns_to_assessor_overrides
    relax_override_level_constraint
    relax_override_ai_level_constraint
    backfill_existing_overrides_as_adjusted
    relax_portfolio_skill_level_constraint
    relax_portfolio_skill_confidence_constraint
    add_evidence_provenance_to_portfolio_skills
    ensure_portfolios_tenant_id
    add_fit_gap_lifecycle
  end

  def down
    # Reverse: drop review columns, restore NOT NULL on ai_level/ai_confidence
    # and override_level/ai_level, drop provenance, drop portfolios.tenant_id if we added it.
    remove_columns_if_exist :assessor_overrides,
      %i[outcome reviewed_level reviewed_by reviewed_at rationale]
    remove_columns_if_exist :portfolio_skills, %i[evidence_provenance]
    remove_columns_if_exist :fit_gap_reports, %i[generation_status generation_error generated_at]

    if column_exists?(:assessor_overrides, :override_level)
      execute <<~SQL
        ALTER TABLE ai_interview.assessor_overrides
          ALTER COLUMN override_level SET NOT NULL;
      SQL
    end

    if column_exists?(:assessor_overrides, :ai_level)
      execute <<~SQL
        ALTER TABLE ai_interview.assessor_overrides
          ALTER COLUMN ai_level SET NOT NULL;
      SQL
    end

    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level;
      ALTER TABLE ai_interview.portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_ai_level
        CHECK (ai_level BETWEEN 1 AND 5);
    SQL

    if column_exists?(:portfolio_skills, :ai_confidence)
      execute <<~SQL
        ALTER TABLE ai_interview.portfolio_skills
          ALTER COLUMN ai_confidence SET NOT NULL;
      SQL
    end

    if column_exists?(:portfolios, :tenant_id)
      remove_index :portfolios, :tenant_id if index_exists?(:portfolios, :tenant_id)
      remove_column :portfolios, :tenant_id
    end
  end

  private

  def add_review_columns_to_assessor_overrides
    add_column :assessor_overrides, :outcome, :string, null: false, default: 'adjusted'
    add_column :assessor_overrides, :reviewed_level, :integer
    add_column :assessor_overrides, :reviewed_by, :bigint
    add_column :assessor_overrides, :reviewed_at, :datetime, precision: 6
    add_column :assessor_overrides, :rationale, :text

    add_index :assessor_overrides, :reviewed_by

    execute <<~SQL
      ALTER TABLE ai_interview.assessor_overrides
        ADD CONSTRAINT chk_assessor_overrides_outcome
        CHECK (outcome IN ('confirmed', 'adjusted', 'insufficient_evidence'));
      ALTER TABLE ai_interview.assessor_overrides
        ADD CONSTRAINT chk_assessor_overrides_reviewed_level
        CHECK (reviewed_level IS NULL OR (reviewed_level BETWEEN 1 AND 5));
    SQL
  end

  def backfill_existing_overrides_as_adjusted
    execute <<~SQL
      UPDATE ai_interview.assessor_overrides
      SET outcome       = 'adjusted',
          reviewed_level = override_level,
          reviewed_by   = overridden_by,
          reviewed_at   = COALESCE(overridden_at, NOW()),
          rationale     = COALESCE(assessor_notes, 'Backfilled from legacy override')
    SQL
  end

  # `override_level` was NOT NULL in the legacy schema. A `confirmed` review has
  # no override level, and `insufficient_evidence` has none either — only
  # `adjusted` carries one. Relax it (validated at the model layer).
  def relax_override_level_constraint
    execute <<~SQL
      ALTER TABLE ai_interview.assessor_overrides
        ALTER COLUMN override_level DROP NOT NULL;
    SQL
  end

  # The AI snapshot level may be nil when the model produced no valid level.
  def relax_override_ai_level_constraint
    execute <<~SQL
      ALTER TABLE ai_interview.assessor_overrides
        ALTER COLUMN ai_level DROP NOT NULL;
    SQL
  end

  def relax_portfolio_skill_level_constraint
    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        DROP CONSTRAINT IF EXISTS chk_portfolio_skills_ai_level;
      ALTER TABLE ai_interview.portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_ai_level
        CHECK (ai_level IS NULL OR (ai_level BETWEEN 1 AND 5));
      ALTER TABLE ai_interview.portfolio_skills
        ALTER COLUMN ai_level DROP NOT NULL;
    SQL
  end

  # A missing/invalid AI output has no confidence either. Relax the NOT NULL
  # so "not assessed" evaluations are representable.
  def relax_portfolio_skill_confidence_constraint
    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        ALTER COLUMN ai_confidence DROP NOT NULL;
    SQL
  end

  def add_evidence_provenance_to_portfolio_skills
    add_column :portfolio_skills, :evidence_provenance, :jsonb, null: false, default: []
  end

  def ensure_portfolios_tenant_id
    if column_exists?(:portfolios, :tenant_id)
      # Existing environments already have the column (drift) — just backfill.
      backfill_portfolios_tenant_id
    else
      add_column :portfolios, :tenant_id, :bigint
      add_index :portfolios, :tenant_id
      backfill_portfolios_tenant_id
    end
  end

  # Portfolios inherit tenant from their session. Safe for existing rows —
  # only touches NULL tenants, and every portfolio has a session.
  def backfill_portfolios_tenant_id
    execute <<~SQL
      UPDATE ai_interview.portfolios p
      SET tenant_id = s.tenant_id
      FROM ai_interview.sessions s
      WHERE p.session_id = s.id
        AND p.tenant_id IS NULL
    SQL
  end

  def remove_columns_if_exist(table, columns)
    columns.each do |col|
      remove_column table, col if column_exists?(table, col)
    end
  end

  # Fit/gap reports get a durable lifecycle: pending → generating → complete | failed.
  # Existing cached reports (rows with data, no lifecycle yet) backfill to 'complete'.
  # Note: `generated_at` already exists in the base schema — only add if missing.
  def add_fit_gap_lifecycle
    return if column_exists?(:fit_gap_reports, :generation_status)

    add_column :fit_gap_reports, :generation_status, :string, null: false, default: 'complete'
    add_column :fit_gap_reports, :generation_error, :text
    add_column :fit_gap_reports, :generated_at, :datetime, precision: 6, default: -> { "NOW()" } unless column_exists?(:fit_gap_reports, :generated_at)
    add_index  :fit_gap_reports, :generation_status

    execute <<~SQL
      ALTER TABLE ai_interview.fit_gap_reports
        ADD CONSTRAINT chk_fit_gap_generation_status
        CHECK (generation_status IN ('pending', 'generating', 'complete', 'failed'));
    SQL
  end
end
