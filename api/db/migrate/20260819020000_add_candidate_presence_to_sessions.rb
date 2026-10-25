class AddCandidatePresenceToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :candidate_online, :boolean, default: false, null: false
    add_column :sessions, :candidate_last_seen_at, :datetime
  end
end