# frozen_string_literal: true

class CreateOrganizationMemberships < ActiveRecord::Migration[7.0]
  def up
    execute "SET search_path TO ai_interview, public"

    create_table :organization_memberships do |t|
      t.bigint :user_id,         null: false
      t.bigint :organization_id, null: false
      t.string :role,            null: false, default: 'assessor', limit: 20
      t.timestamps null: false
    end

    add_index :organization_memberships, %i[user_id organization_id], unique: true, name: 'idx_org_memberships_user_org'
    add_index :organization_memberships, :organization_id, name: 'idx_org_memberships_org'
  end

  def down
    drop_table :organization_memberships
  end
end
