# frozen_string_literal: true

class CreateAdministratorInvitations < ActiveRecord::Migration[7.0]
  def change
    create_table :administrator_invitations, id: :uuid do |t|
      t.bigint :tenant_id, null: false
      t.bigint :inviter_id, null: false
      t.string :recipient_email, limit: 255, null: false
      t.string :token_digest, limit: 64, null: false
      t.datetime :expires_at, null: false
      t.datetime :accepted_at
      t.datetime :revoked_at
      t.timestamps null: false
    end

    add_index :administrator_invitations, :token_digest, unique: true
    add_index :administrator_invitations, %i[tenant_id created_at],
              name: 'idx_admin_invitations_tenant_created'
    add_index :administrator_invitations, %i[tenant_id recipient_email],
              name: 'idx_admin_invitations_tenant_email'
    add_index :administrator_invitations, %i[tenant_id expires_at],
              name: 'idx_admin_invitations_tenant_expiry'
    add_foreign_key :administrator_invitations, :organizations, column: :tenant_id
    add_foreign_key :administrator_invitations, :users, column: :inviter_id
    add_check_constraint :administrator_invitations,
                         'accepted_at IS NULL OR revoked_at IS NULL',
                         name: 'chk_admin_invitations_terminal_state'
  end
end
