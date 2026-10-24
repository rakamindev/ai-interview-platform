# frozen_string_literal: true

class AddAudioCompletionReadyAtToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :audio_completion_ready_at, :datetime
  end
end
