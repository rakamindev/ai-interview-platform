# frozen_string_literal: true

class AddArchivedAtToAssessmentsAndVacancies < ActiveRecord::Migration[7.0]
  def change
    add_column :assessments, :archived_at, :datetime
    add_column :vacancies, :archived_at, :datetime
    add_index :assessments, :archived_at
    add_index :vacancies, :archived_at
  end
end
