# frozen_string_literal: true

class AddConsentFieldsToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :consented_at, :datetime
    add_column :sessions, :consent_ip, :string, limit: 45
    add_column :sessions, :terms_version, :string, limit: 50
  end
end
