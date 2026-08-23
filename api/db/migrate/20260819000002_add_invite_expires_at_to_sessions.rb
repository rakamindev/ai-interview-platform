# frozen_string_literal: true

# Adds invite_expires_at to sessions so invite tokens expire after 14 days.
# Backfills existing sessions to created_at + 14 days.
class AddInviteExpiresAtToSessions < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    add_column :sessions, :invite_expires_at, :datetime

    # Backfill existing sessions: created_at + 14 days
    execute <<~SQL.squish
      UPDATE ai_interview.sessions
      SET invite_expires_at = created_at + INTERVAL '14 days'
      WHERE invite_expires_at IS NULL
    SQL

    add_index :sessions, :invite_expires_at

    change_column_null :sessions, :invite_expires_at, false
  end

  def down
    remove_column :sessions, :invite_expires_at
  end
end
