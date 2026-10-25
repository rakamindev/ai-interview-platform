class AddVacancyToAssessments < ActiveRecord::Migration[7.0]
  def change
    add_reference :assessments, :vacancy, null: true, foreign_key: true, type: :bigint
  end
end
