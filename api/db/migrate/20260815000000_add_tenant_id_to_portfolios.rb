# frozen_string_literal: true

# Attaches every portfolio to the tenant that owns its session, closing the
# cross-tenant IDOR hole on the portfolio subtree (portfolio skills, fit/gap
# reports and assessor overrides hang off Portfolio).
class AddTenantIdToPortfolios < ActiveRecord::Migration[7.0]
  def up
    add_column :portfolios, :tenant_id, :bigint

    # Backfill from the owning session. portfolios.session_id is a foreign key,
    # so no row can be left without a tenant.
    execute <<~SQL
      UPDATE portfolios
      SET tenant_id = sessions.tenant_id
      FROM sessions
      WHERE portfolios.session_id = sessions.id
    SQL

    change_column_null :portfolios, :tenant_id, false
    add_index :portfolios, :tenant_id
  end

  def down
    remove_index :portfolios, :tenant_id
    remove_column :portfolios, :tenant_id
  end
end
