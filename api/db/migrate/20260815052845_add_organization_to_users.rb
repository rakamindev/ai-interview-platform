# api/db/migrate/20260815050937_add_organization_to_users.rb
# frozen_string_literal: true

class AddOrganizationToUsers < ActiveRecord::Migration[7.0]
  def up
    add_column :users, :organization_id, :bigint

    org_ids = ActiveRecord::Base.connection.select_values('SELECT id FROM organizations')

    add_index :users, :organization_id
    add_foreign_key :users, :organizations, column: :organization_id, validate: false

    if org_ids.size == 1
      execute("UPDATE users SET organization_id = #{org_ids.first.to_i} WHERE organization_id IS NULL")
      change_column_null :users, :organization_id, false
    else
      # Ambiguous: 0 or >1 organizations exist, so we cannot safely guess which
      # org each existing user belongs to. Left nullable rather than assigning
      # a wrong org silently — documented in assessment/findings as an
      # explicit assumption for production rollout, which would need a real
      # mapping decided by the team (e.g. from rakamin-api's own user/org
      # membership data) rather than an automatic guess.
      say "WARNING: found #{org_ids.size} organizations — could not auto-backfill " \
          "users.organization_id. Column left nullable. Assign manually, then run " \
          "change_column_null :users, :organization_id, false in a follow-up migration.", true
    end
  end

  def down
    remove_foreign_key :users, :organizations, column: :organization_id, if_exists: true
    remove_index :users, :organization_id, if_exists: true
    remove_column :users, :organization_id
  end
end