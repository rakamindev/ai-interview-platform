class AddRoleTitleToAssessments < ActiveRecord::Migration[7.0]
  def change
    add_column :assessments, :role_title, :string, limit: 255

    reversible do |dir|
      dir.up do
        execute <<~SQL
          UPDATE assessments SET role_title = name WHERE role_title IS NULL
        SQL
      end
    end
  end
end