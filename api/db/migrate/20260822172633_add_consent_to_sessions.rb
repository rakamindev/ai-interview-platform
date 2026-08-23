class AddConsentToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :consent_given_at, :datetime
  end
end
