# frozen_string_literal: true

# SEC-2: bind AI-interview users to an organization so tenant is derived from the
# authenticated user rather than a client-controlled header.
class AddOrganizationToUsers < ActiveRecord::Migration[7.0]
  def up
    execute 'SET search_path TO ai_interview, public'

    add_column :users, :organization_id, :bigint
    add_index :users, :organization_id

    # Backfill existing users to the first organization (single-tenant/dev setups).
    first_org_id = execute('SELECT id FROM public.organizations ORDER BY id LIMIT 1').first&.fetch('id')
    execute("UPDATE ai_interview.users SET organization_id = #{first_org_id.to_i} WHERE organization_id IS NULL") if first_org_id
  end

  def down
    execute 'SET search_path TO ai_interview, public'
    remove_index :users, :organization_id
    remove_column :users, :organization_id
  end
end
