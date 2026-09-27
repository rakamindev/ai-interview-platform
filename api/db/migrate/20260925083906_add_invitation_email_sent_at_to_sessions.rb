class AddInvitationEmailSentAtToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :invitation_email_sent_at, :datetime
  end
end
