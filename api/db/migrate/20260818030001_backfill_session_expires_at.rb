class BackfillSessionExpiresAt < ActiveRecord::Migration[7.0]
  def up
    retention_days = ENV.fetch('CANDIDATE_DATA_RETENTION_DAYS', '90').to_i

    Session.unscoped.where(status: 'ended', expires_at: nil).where.not(ended_at: nil).find_each do |session|
      session.update_column(:expires_at, session.ended_at + retention_days.days)
    end
  end

  def down
    # Irreversible: no record of which rows were backfilled vs. set by later code.
  end
end
