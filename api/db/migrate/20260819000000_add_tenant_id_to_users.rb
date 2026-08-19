# frozen_string_literal: true

# `users` had no relationship to `organizations` at all, so
# AuthenticationController#authenticate had nothing to validate a login's
# requested org against — it trusted the client-supplied X-Tenant-Scheme
# header (or an arbitrary fallback org) to decide which tenant the freshly
# minted JWT should be scoped to. Any admin credential could mint a
# correctly-scoped token for any organization. See authentication_controller.rb.
#
# No existing User rows to backfill (db/seeds.rb creates none), so this adds
# the column straight to NOT NULL rather than expand/backfill/contract.
class AddTenantIdToUsers < ActiveRecord::Migration[7.0]
  def up
    add_column :users, :tenant_id, :bigint
    add_index  :users, :tenant_id

    raise 'Existing users with no tenant_id — backfill before enforcing NOT NULL' \
      if User.where(tenant_id: nil).exists?

    change_column_null :users, :tenant_id, false
  end

  def down
    remove_index  :users, :tenant_id
    remove_column :users, :tenant_id
  end
end
