# frozen_string_literal: true

class AddConsentAtToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :consent_at, :datetime
  end
end
