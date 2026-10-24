# frozen_string_literal: true

class PreventDuplicateVacancySkills < ActiveRecord::Migration[7.0]
  def change
    add_index :vacancy_skills,
              %i[vacancy_id skill_id],
              unique: true,
              where: 'skill_id IS NOT NULL',
              name: 'index_vacancy_skills_on_vacancy_and_taxonomy_skill'
  end
end
