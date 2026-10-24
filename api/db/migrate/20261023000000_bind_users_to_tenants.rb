# frozen_string_literal: true

class BindUsersToTenants < ActiveRecord::Migration[7.0]
  def change
    add_reference :users, :tenant, index: true, null: true
    add_foreign_key :users, :organizations, column: :tenant_id
  end
end
