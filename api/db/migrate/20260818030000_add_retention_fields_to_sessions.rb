# frozen_string_literal: true

class AddRetentionFieldsToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :expires_at, :datetime
    add_column :sessions, :data_purged_at, :datetime
    add_index :sessions, :expires_at
  end
end
