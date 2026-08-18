# frozen_string_literal: true

# Adds candidate consent records (UU PDP) and binds users to a tenant.
#
# Reversible and safe against existing rows:
#   - candidate_consents is a brand-new table (no backfill needed).
#   - users.tenant_id is nullable so existing rows are untouched; a user without
#     a tenant is rejected at login until an admin assigns one.
class CreateCandidateConsentsAndBindUsersToTenants < ActiveRecord::Migration[7.0]
  def change
    create_table :candidate_consents do |t|
      t.references :session, null: false, foreign_key: true, index: { unique: true }
      t.string  :policy_version,    null: false, default: '1.0', limit: 20
      t.string  :status,            null: false, default: 'pending', limit: 20
      t.datetime :accepted_at, precision: 6
      t.datetime :declined_at, precision: 6
      t.string  :consent_ip,        limit: 64
      t.string  :consent_user_agent, limit: 512
      t.timestamps null: false
    end

    add_column :users, :tenant_id, :bigint
    add_index  :users, :tenant_id
  end
end
