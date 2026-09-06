# frozen_string_literal: true

class AddCompletionAndFailureMetadataToSessions < ActiveRecord::Migration[7.0]
  def change
    # Nullable fields preserve every existing session. Store short provider
    # failure codes only; raw provider messages may contain candidate content.
    add_column :sessions, :completion_authorized_at, :datetime
    add_column :sessions, :failure_code, :string, limit: 64
    add_column :sessions, :failure_at, :datetime
  end
end
