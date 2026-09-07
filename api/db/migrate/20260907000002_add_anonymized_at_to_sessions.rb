# frozen_string_literal: true

class AddAnonymizedAtToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :anonymized_at, :datetime
    add_index  :sessions, %i[created_at anonymized_at], name: "idx_sessions_retention_cleanup"
  end
end
