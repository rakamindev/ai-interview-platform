# frozen_string_literal: true

class AddIsCustomToVacancySkills < ActiveRecord::Migration[7.0]
  def change
    add_column :vacancy_skills, :is_custom, :boolean, default: false, null: false

    reversible do |dir|
      dir.up do
        execute 'UPDATE vacancy_skills SET is_custom = true WHERE skill_id IS NULL'
      end
    end

    add_check_constraint :vacancy_skills,
                         'skill_id IS NOT NULL OR is_custom = true',
                         name: 'chk_vacancy_skills_custom_or_id'
  end
end
