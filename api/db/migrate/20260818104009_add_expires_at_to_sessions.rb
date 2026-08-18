class AddExpiresAtToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :expires_at, :datetime
    add_index  :sessions, :expires_at
    
    reversible do |dir|
      dir.up do
        execute "UPDATE ai_interview.sessions SET expires_at = created_at + interval '7 days' WHERE expires_at IS NULL"
        change_column_null :sessions, :expires_at, false
      end
    end
  end
end