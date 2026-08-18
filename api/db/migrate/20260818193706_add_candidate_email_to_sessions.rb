class AddCandidateEmailToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :candidate_email, :string
  end
end
