# frozen_string_literal: true

class AddPrivacyAcknowledgedAtToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :privacy_acknowledged_at, :datetime
  end
end
