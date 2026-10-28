# frozen_string_literal: true

class AddConsentTrackingToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :consented_at, :datetime
    add_column :sessions, :consent_version, :string, limit: 20
  end
end
