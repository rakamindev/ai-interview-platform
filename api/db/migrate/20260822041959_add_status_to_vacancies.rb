class AddStatusToVacancies < ActiveRecord::Migration[7.0]
  def change
    # prefer using string instead number because its harder to read sql if there are too many enums
    add_column :vacancies, :status, :string
  end
end
