# frozen_string_literal: true

class AddCandidateConsentToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :candidate_consent, :boolean, default: false, null: false
    add_column :sessions, :consented_at, :datetime
    add_column :sessions, :consent_locale, :string, default: 'id'
  end
end
