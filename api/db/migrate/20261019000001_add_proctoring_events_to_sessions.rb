# frozen_string_literal: true

# When a proctored interview's camera or screen share stopped and came back, as the candidate page reported it:
# [{ "event" => "camera_stopped", "at" => ISO 8601 }, ...]. Capped in the model; empty for every existing session.
class AddProctoringEventsToSessions < ActiveRecord::Migration[8.1]
  def change
    add_column :sessions, :proctoring_events, :jsonb, null: false, default: []
  end
end
