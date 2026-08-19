# frozen_string_literal: true

class AddTenantIdToPortfolios < ActiveRecord::Migration[7.0]
  def up
    add_column :portfolios, :tenant_id, :bigint
    add_column :portfolio_skills, :tenant_id, :bigint

    # Backfill from the parent chain: portfolio.tenant_id <- session.tenant_id,
    # portfolio_skill.tenant_id <- portfolio.tenant_id (already backfilled above).
    # Orphan check first: a portfolio whose session no longer exists would be
    # backfilled to NULL and then fail the NOT NULL constraint below — which
    # is the correct behavior (loud failure), not something to paper over.
    execute <<~SQL.squish
      UPDATE portfolios
      SET tenant_id = sessions.tenant_id
      FROM sessions
      WHERE portfolios.session_id = sessions.id
    SQL

    execute <<~SQL.squish
      UPDATE portfolio_skills
      SET tenant_id = portfolios.tenant_id
      FROM portfolios
      WHERE portfolio_skills.portfolio_id = portfolios.id
    SQL

    orphaned_portfolios = ActiveRecord::Base.connection.select_value(
      'SELECT COUNT(*) FROM portfolios WHERE tenant_id IS NULL'
    ).to_i
    orphaned_skills = ActiveRecord::Base.connection.select_value(
      'SELECT COUNT(*) FROM portfolio_skills WHERE tenant_id IS NULL'
    ).to_i

    if orphaned_portfolios.positive? || orphaned_skills.positive?
      raise ActiveRecord::IrreversibleMigration,
            "Found #{orphaned_portfolios} portfolio(s) and #{orphaned_skills} " \
            'portfolio_skill(s) with no resolvable tenant_id (likely orphaned ' \
            'session references). Resolve these rows manually before re-running ' \
            'this migration — refusing to guess.'
    end

    change_column_null :portfolios, :tenant_id, false
    change_column_null :portfolio_skills, :tenant_id, false

    add_index :portfolios, :tenant_id
    add_index :portfolio_skills, :tenant_id
  end

  def down
    remove_index :portfolios, :tenant_id, if_exists: true
    remove_index :portfolio_skills, :tenant_id, if_exists: true
    remove_column :portfolios, :tenant_id
    remove_column :portfolio_skills, :tenant_id
  end
end