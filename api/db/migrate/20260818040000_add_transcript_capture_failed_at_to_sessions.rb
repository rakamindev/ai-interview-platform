# frozen_string_literal: true

class AddTranscriptCaptureFailedAtToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :transcript_capture_failed_at, :datetime
  end
end
