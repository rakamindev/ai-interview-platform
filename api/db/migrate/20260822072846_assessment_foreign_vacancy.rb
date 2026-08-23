class AssessmentForeignVacancy < ActiveRecord::Migration[7.0]
  def change
    add_reference :assessments, :vacancy, foreign_key: true
  end
end
