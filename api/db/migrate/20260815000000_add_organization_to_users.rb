# frozen_string_literal: true

class AddOrganizationToUsers < ActiveRecord::Migration[7.0]
  def change
    add_column :users, :organization_id, :bigint
    add_index :users, :organization_id
  end
end
