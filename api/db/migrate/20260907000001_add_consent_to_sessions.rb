# frozen_string_literal: true

class AddConsentToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :consented_at, :datetime
    add_column :sessions, :consent_version, :string, limit: 20
    add_column :sessions, :consent_ip_address, :string, limit: 45
    add_column :sessions, :consent_user_agent, :string, limit: 255
  end
end
