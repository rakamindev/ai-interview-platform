class AddInviteExpiryToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :expires_at, :datetime
    add_column :sessions, :revoked_at, :datetime

    reversible do |dir|
      dir.up do
        execute <<~SQL
          UPDATE sessions SET expires_at = created_at + interval '7 days'
          WHERE status = 'pending' AND expires_at IS NULL
        SQL
      end
    end
  end
end