# frozen_string_literal: true

class AddProctoringConsentedAtToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :proctoring_consented_at, :datetime
  end
end
