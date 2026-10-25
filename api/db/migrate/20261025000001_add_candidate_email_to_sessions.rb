# frozen_string_literal: true

class AddCandidateEmailToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :candidate_email, :string, limit: 255
  end
end
