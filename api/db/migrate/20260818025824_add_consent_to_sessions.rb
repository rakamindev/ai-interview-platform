# frozen_string_literal: true

class AddConsentToSessions < ActiveRecord::Migration[7.0]
  # UU PDP: candidates must consent before their voice interview is recorded.
  # Nullable on purpose — existing sessions predate consent capture.
  def change
    add_column :sessions, :consent_recorded_at, :datetime
  end
end