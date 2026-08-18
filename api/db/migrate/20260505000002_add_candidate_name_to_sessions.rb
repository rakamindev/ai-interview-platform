class AddCandidateNameToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :candidate_name, :string, limit: 255
  end
end
