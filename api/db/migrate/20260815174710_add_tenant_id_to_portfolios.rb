# frozen_string_literal: true

class AddTenantIdToPortfolios < ActiveRecord::Migration[7.0]
  def up
    # 1. Add column (nullable initially for backfill)
    add_column :portfolios, :tenant_id, :bigint

    # 2. Backfill tenant_id from session.tenant_id
    execute <<~SQL
      UPDATE portfolios
      SET tenant_id = sessions.tenant_id
      FROM sessions
      WHERE portfolios.session_id = sessions.id
    SQL

    # 3. Verify backfill (all rows must have tenant_id)
    null_count = execute("SELECT COUNT(*) FROM portfolios WHERE tenant_id IS NULL").first['count'].to_i
    raise "Backfill failed: #{null_count} portfolios still have NULL tenant_id" if null_count > 0

    # 4. Add NOT NULL constraint
    change_column_null :portfolios, :tenant_id, false

    # 5. Add foreign key and index
    add_foreign_key :portfolios, :organizations, column: :tenant_id
    add_index :portfolios, :tenant_id
  end

  def down
    remove_foreign_key :portfolios, :organizations
    remove_index :portfolios, :tenant_id
    remove_column :portfolios, :tenant_id
  end
end
