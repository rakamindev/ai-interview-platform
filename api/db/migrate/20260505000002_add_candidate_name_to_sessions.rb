# frozen_string_literal: true

class AddCandidateNameToSessions < ActiveRecord::Migration[8.0]
  def change
    add_column :sessions, :candidate_name, :string, limit: 255
  end
end
