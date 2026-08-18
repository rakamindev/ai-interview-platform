# frozen_string_literal: true

class AddPublicRequirementTextToVacancies < ActiveRecord::Migration[7.0]
  def change
    add_column :vacancies, :public_requirement_text, :text
  end
end
