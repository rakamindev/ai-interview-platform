class AddVacancyIdToAssessments < ActiveRecord::Migration[7.0]
  def change
    add_column :assessments, :vacancy_id, :bigint
  end
end
