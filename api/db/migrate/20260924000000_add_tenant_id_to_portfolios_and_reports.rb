# frozen_string_literal: true

class AddTenantIdToPortfoliosAndReports < ActiveRecord::Migration[7.0]
  def up
    # 1. Add tenant_id columns as nullable initially for safe backfill
    add_column :portfolios, :tenant_id, :bigint
    add_column :portfolio_skills, :tenant_id, :bigint
    add_column :fit_gap_reports, :tenant_id, :bigint

    # 2. Backfill existing records from parent sessions / portfolios
    execute <<~SQL
      UPDATE ai_interview.portfolios p
      SET tenant_id = s.tenant_id
      FROM ai_interview.sessions s
      WHERE p.session_id = s.id AND p.tenant_id IS NULL;

      UPDATE ai_interview.portfolio_skills ps
      SET tenant_id = p.tenant_id
      FROM ai_interview.portfolios p
      WHERE ps.portfolio_id = p.id AND ps.tenant_id IS NULL;

      UPDATE ai_interview.fit_gap_reports fgr
      SET tenant_id = p.tenant_id
      FROM ai_interview.portfolios p
      WHERE fgr.portfolio_id = p.id AND fgr.tenant_id IS NULL;
    SQL

    # Fallback default for any orphan records (if any)
    first_tenant_id = execute("SELECT id FROM public.organizations ORDER BY id ASC LIMIT 1").first&.dig('id')
    if first_tenant_id
      execute <<~SQL
        UPDATE ai_interview.portfolios SET tenant_id = #{first_tenant_id} WHERE tenant_id IS NULL;
        UPDATE ai_interview.portfolio_skills SET tenant_id = #{first_tenant_id} WHERE tenant_id IS NULL;
        UPDATE ai_interview.fit_gap_reports SET tenant_id = #{first_tenant_id} WHERE tenant_id IS NULL;
      SQL
    end

    # 3. Enforce NOT NULL constraints
    change_column_null :portfolios, :tenant_id, false
    change_column_null :portfolio_skills, :tenant_id, false
    change_column_null :fit_gap_reports, :tenant_id, false

    # 4. Add indexes for tenant scoped queries
    add_index :portfolios, :tenant_id unless index_exists?(:portfolios, :tenant_id)
    add_index :portfolio_skills, :tenant_id unless index_exists?(:portfolio_skills, :tenant_id)
    add_index :fit_gap_reports, :tenant_id unless index_exists?(:fit_gap_reports, :tenant_id)
  end

  def down
    remove_index :fit_gap_reports, :tenant_id if index_exists?(:fit_gap_reports, :tenant_id)
    remove_index :portfolio_skills, :tenant_id if index_exists?(:portfolio_skills, :tenant_id)
    remove_index :portfolios, :tenant_id if index_exists?(:portfolios, :tenant_id)

    remove_column :fit_gap_reports, :tenant_id
    remove_column :portfolio_skills, :tenant_id
    remove_column :portfolios, :tenant_id
  end
end
