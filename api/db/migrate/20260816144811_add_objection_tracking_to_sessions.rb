class AddObjectionTrackingToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :audit_status, :string
    add_column :sessions, :candidate_objection_notes, :text
    add_column :sessions, :resolved_at, :datetime
    add_column :sessions, :resolution_notes, :text
  end
end
