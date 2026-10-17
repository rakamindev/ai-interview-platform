class AddConsentFieldsToSessions < ActiveRecord::Migration[7.0]
  def up
    add_column :sessions, :consent_status, :string, default: 'none', null: false
    add_column :sessions, :consent_version, :string
    add_column :sessions, :consented_at, :datetime
    add_column :sessions, :consent_revoked_at, :datetime
    add_column :sessions, :consent_text_hash, :string

    add_check_constraint :sessions,
                         "consent_status IN ('none', 'given', 'revoked')",
                         name: 'chk_sessions_consent_status'
  end

  def down
    remove_check_constraint :sessions, name: 'chk_sessions_consent_status'
    remove_column :sessions, :consent_status
    remove_column :sessions, :consent_version
    remove_column :sessions, :consented_at
    remove_column :sessions, :consent_revoked_at
    remove_column :sessions, :consent_text_hash
  end
end