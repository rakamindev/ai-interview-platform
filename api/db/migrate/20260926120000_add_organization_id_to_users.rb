# frozen_string_literal: true

# Local admins lived in a global table, so any admin could ask for a token for
# any tenant. Binding a user to one organization closes that.
#
# Safe against existing rows: the column is nullable and existing users are only
# backfilled when there is exactly one organization (unambiguous single-tenant
# install). With several organizations we cannot guess, so rows stay NULL and
# login fails closed until an operator assigns them. No FK: organizations is a
# table owned by the sister rakamin-api app in the public schema.
class AddOrganizationIdToUsers < ActiveRecord::Migration[7.0]
  def up
    add_column :users, :organization_id, :bigint
    add_index  :users, :organization_id

    execute <<~SQL.squish
      UPDATE users
         SET organization_id = (SELECT id FROM public.organizations LIMIT 1)
       WHERE organization_id IS NULL
         AND (SELECT COUNT(*) FROM public.organizations) = 1
    SQL
  end

  def down
    remove_index  :users, :organization_id
    remove_column :users, :organization_id
  end
end
