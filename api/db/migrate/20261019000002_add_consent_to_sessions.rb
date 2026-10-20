class AddConsentToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :consent_accepted_at, :datetime
    add_column :sessions, :consent_version, :string
    add_column :sessions, :consent_declined_at, :datetime
  end
end
