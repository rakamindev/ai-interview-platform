# frozen_string_literal: true

# Identifies which browser audio connection owns a session, so Puma workers that share no memory
# can agree on who may act for it after a reconnect. Nullable: existing rows have no live connection.
class AddActiveConnectionIdToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :active_connection_id, :string, limit: 36
  end
end
