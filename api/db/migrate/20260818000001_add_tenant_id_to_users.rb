# frozen_string_literal: true

class AddTenantIdToUsers < ActiveRecord::Migration[7.0]
  def up
    execute "SET search_path TO ai_interview, public"

    add_column :users, :tenant_id, :bigint
    add_index :users, :tenant_id, name: 'idx_ai_interview_users_tenant_id'
  end

  def down
    execute "SET search_path TO ai_interview, public"

    remove_index :users, name: 'idx_ai_interview_users_tenant_id'
    remove_column :users, :tenant_id
  end
end
