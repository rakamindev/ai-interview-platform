class AddInvitationSettingsToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :candidate_email, :string
    add_column :sessions, :expires_at, :datetime
    add_column :sessions, :reminder_sent_at, :datetime
  end
end
