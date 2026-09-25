# frozen_string_literal: true

class AddVacancyIdToAssessments < ActiveRecord::Migration[7.0]
  def change
    add_reference :assessments, :vacancy, foreign_key: { to_table: :vacancies }, null: true, index: true
  end
end
