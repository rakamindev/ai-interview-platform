# frozen_string_literal: true

class AddInviteExpiresAtToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :invite_expires_at, :datetime
  end
end
