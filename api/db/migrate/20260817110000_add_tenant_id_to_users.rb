# frozen_string_literal: true

# F-03 phase 2 (decision evolution A → D): every user belongs to exactly one
# organization. Tenancy is derived from this relation at login — never from
# anything the user types (the phase 1 explicit tenant field is revoked).
#
# Backfill: existing users (dev/test only — no app code creates users) are
# assigned to the default organization (id 0) or, failing that, the first
# organization by id. The organizations table is shared with rakamin-api and is
# never empty in practice; if it somehow is, the NOT NULL change fails loudly
# instead of silently leaving users without a tenant.
class AddTenantIdToUsers < ActiveRecord::Migration[7.0]
  def up
    add_column :users, :tenant_id, :bigint

    org_id = select_value('SELECT id FROM organizations ORDER BY id LIMIT 1')
    if org_id
      execute("UPDATE users SET tenant_id = #{org_id} WHERE tenant_id IS NULL")
    end

    change_column_null :users, :tenant_id, false
    add_index :users, :tenant_id
    add_foreign_key :users, :organizations, column: :tenant_id
  end

  def down
    remove_foreign_key :users, column: :tenant_id
    remove_index :users, :tenant_id
    remove_column :users, :tenant_id
  end
end