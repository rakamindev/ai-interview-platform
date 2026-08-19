class AddInviteExpiresAtToSessions < ActiveRecord::Migration[7.0]
  def up
    add_column :sessions, :invite_expires_at, :datetime

    # Backfill existing pending invites with a fresh grace period from
    # migration time — they predate the TTL concept, so expiring them
    # retroactively from their original created_at would invalidate
    # invites nobody asked to expire yet. Active/ended sessions are left
    # null; expiry is never checked once a session has started (see
    # Session#invite_expired?).
    ttl_hours = ENV.fetch('INVITE_TOKEN_TTL_HOURS', 72).to_i
    execute <<~SQL.squish
      UPDATE sessions
      SET invite_expires_at = now() + interval '#{ttl_hours} hours'
      WHERE status = 'pending'
    SQL
  end

  def down
    remove_column :sessions, :invite_expires_at
  end
end
