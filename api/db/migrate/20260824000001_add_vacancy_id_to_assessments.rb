# frozen_string_literal: true

class AddVacancyIdToAssessments < ActiveRecord::Migration[7.0]
  def change
    add_reference :assessments, :vacancy, null: true, foreign_key: { on_delete: :nullify }
  end
end
