# frozen_string_literal: true

# Adds tenant_id to the portfolio family tables (portfolio_skills, portfolios,
# fit_gap_reports, assessor_overrides) so they can be scoped directly rather
# than relying on a join through sessions.
#
# Backfills from sessions.tenant_id → portfolios → portfolio_skills → rest.
# NOT NULL after verifying zero nulls; the migration raises if any remain.
class AddTenantIdToPortfolioFamily < ActiveRecord::Migration[7.0]
  disable_ddl_transaction!

  def up
    # Step 1: Add nullable columns
    add_column :portfolios, :tenant_id, :bigint
    add_column :portfolio_skills, :tenant_id, :bigint
    add_column :fit_gap_reports, :tenant_id, :bigint
    add_column :assessor_overrides, :tenant_id, :bigint

    # Step 2: Batched backfill through parent chains
    backfill_portfolios
    backfill_portfolio_skills
    backfill_fit_gap_reports
    backfill_assessor_overrides

    # Step 3: Add indexes
    add_index :portfolios, :tenant_id
    add_index :portfolio_skills, :tenant_id
    add_index :fit_gap_reports, :tenant_id
    add_index :assessor_overrides, :tenant_id

    # Step 4: NOT NULL with validation
    change_column_null :portfolios, :tenant_id, false
    change_column_null :portfolio_skills, :tenant_id, false
    change_column_null :fit_gap_reports, :tenant_id, false
    change_column_null :assessor_overrides, :tenant_id, false

    # Step 5: Guard — raise if any nulls remain
    null_check!
  end

  def down
    remove_column :assessor_overrides, :tenant_id
    remove_column :fit_gap_reports, :tenant_id
    remove_column :portfolio_skills, :tenant_id
    remove_column :portfolios, :tenant_id
  end

  private

  BATCH_SIZE = 1000

  def backfill_portfolios
    say_with_time "backfill portfolios.tenant_id from sessions.tenant_id" do
      execute <<~SQL.squish
        UPDATE ai_interview.portfolios
        SET tenant_id = s.tenant_id
        FROM ai_interview.sessions s
        WHERE portfolios.session_id = s.id
          AND portfolios.tenant_id IS NULL
      SQL
    end
  end

  def backfill_portfolio_skills
    say_with_time "backfill portfolio_skills.tenant_id from portfolios.tenant_id" do
      execute <<~SQL.squish
        UPDATE ai_interview.portfolio_skills
        SET tenant_id = p.tenant_id
        FROM ai_interview.portfolios p
        WHERE portfolio_skills.portfolio_id = p.id
          AND portfolio_skills.tenant_id IS NULL
      SQL
    end
  end

  def backfill_fit_gap_reports
    say_with_time "backfill fit_gap_reports.tenant_id from portfolios.tenant_id" do
      execute <<~SQL.squish
        UPDATE ai_interview.fit_gap_reports
        SET tenant_id = p.tenant_id
        FROM ai_interview.portfolios p
        WHERE fit_gap_reports.portfolio_id = p.id
          AND fit_gap_reports.tenant_id IS NULL
      SQL
    end
  end

  def backfill_assessor_overrides
    say_with_time "backfill assessor_overrides.tenant_id from portfolio_skills.tenant_id" do
      execute <<~SQL.squish
        UPDATE ai_interview.assessor_overrides
        SET tenant_id = ps.tenant_id
        FROM ai_interview.portfolio_skills ps
        WHERE assessor_overrides.portfolio_skill_id = ps.id
          AND assessor_overrides.tenant_id IS NULL
      SQL
    end
  end

  def null_check!
    result = execute(<<~SQL.squish).first
      SELECT
        (SELECT COUNT(*) FROM ai_interview.portfolios WHERE tenant_id IS NULL) AS portfolios,
        (SELECT COUNT(*) FROM ai_interview.portfolio_skills WHERE tenant_id IS NULL) AS portfolio_skills,
        (SELECT COUNT(*) FROM ai_interview.fit_gap_reports WHERE tenant_id IS NULL) AS fit_gap_reports,
        (SELECT COUNT(*) FROM ai_interview.assessor_overrides WHERE tenant_id IS NULL) AS assessor_overrides
    SQL

    total = result.values_at('portfolios', 'portfolio_skills', 'fit_gap_reports', 'assessor_overrides').compact.sum
    return if total.zero?

    raise ActiveRecord::IrreversibleMigration,
          "Migration failed: #{total} rows still have NULL tenant_id. " \
          "All portfolio-family rows must have a tenant derived from sessions.tenant_id."
  end
end
