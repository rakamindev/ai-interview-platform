# frozen_string_literal: true

class AddArchivedAtToAssessments < ActiveRecord::Migration[7.0]
  def change
    add_column :assessments, :archived_at, :datetime
    add_index :assessments, :archived_at
  end
end
