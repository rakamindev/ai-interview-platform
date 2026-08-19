# frozen_string_literal: true

class AddConsentedAtToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :consented_at, :datetime
  end
end