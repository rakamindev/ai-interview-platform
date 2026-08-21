# frozen_string_literal: true

class AddExpiresAtToSessions < ActiveRecord::Migration[7.0]
  def up
    add_column :sessions, :expires_at, :datetime
    add_index :sessions, :expires_at

    # Set default expiration for existing sessions (7 days from now)
    execute "UPDATE ai_interview.sessions SET expires_at = NOW() + INTERVAL '7 days' WHERE expires_at IS NULL"
  end

  def down
    remove_index :sessions, :expires_at
    remove_column :sessions, :expires_at
  end
end
