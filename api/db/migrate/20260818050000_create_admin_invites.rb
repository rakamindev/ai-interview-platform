# frozen_string_literal: true

class CreateAdminInvites < ActiveRecord::Migration[7.0]
  def change
    create_table :admin_invites do |t|
      t.bigint :tenant_id, null: false
      t.string :email, limit: 255, null: false
      t.string :role, limit: 20, null: false
      t.string :invite_token, limit: 64, null: false
      t.datetime :expires_at, null: false
      t.datetime :accepted_at
      t.bigint :created_by, null: false
      t.datetime :created_at, null: false
    end

    add_index :admin_invites, :invite_token, unique: true
    add_index :admin_invites, %i[tenant_id email]
  end
end
