# frozen_string_literal: true

class AddCandidateConsentToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :consent_given_at, :datetime
    add_column :sessions, :consent_version, :string, limit: 50
    add_column :sessions, :pdp_retention_acknowledged, :boolean, default: false, null: false

    add_index :sessions, :consent_given_at
  end
end

