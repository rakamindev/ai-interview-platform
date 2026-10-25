# frozen_string_literal: true

# F-06: persist the "preparing to end" proof so the public audio_complete endpoint
# can verify that the WebSocket layer really authorized the transition.
# Nullable — only set for the brief window before the session ends.
class AddPreparingToEndAtToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :preparing_to_end_at, :datetime
  end
end