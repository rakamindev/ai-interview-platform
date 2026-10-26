# frozen_string_literal: true

class AddUuPdpConsentToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :consent_given_at, :datetime
    add_column :sessions, :consent_version, :string, limit: 50
  end
end
