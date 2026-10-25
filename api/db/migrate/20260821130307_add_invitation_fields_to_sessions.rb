class AddInvitationFieldsToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :candidate_email, :string
    add_column :sessions, :invitation_status, :string, default: 'pending'
    add_column :sessions, :invitation_sent_at, :datetime
    add_column :sessions, :invitation_error, :text
  end
end
