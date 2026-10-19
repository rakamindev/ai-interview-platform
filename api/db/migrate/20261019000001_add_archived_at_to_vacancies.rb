# frozen_string_literal: true

class AddArchivedAtToVacancies < ActiveRecord::Migration[7.0]
  def change
    add_column :vacancies, :archived_at, :datetime
    add_index :vacancies, :archived_at
  end
end
