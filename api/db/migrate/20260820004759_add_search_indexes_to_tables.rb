class AddSearchIndexesToTables < ActiveRecord::Migration[7.0]
  def change
    add_index :assessments, :name
    add_index :vacancies, :role_title
    add_index :sessions, :candidate_name
  end
end
