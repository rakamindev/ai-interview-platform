# frozen_string_literal: true

class PreventDuplicateTaxonomySkills < ActiveRecord::Migration[7.0]
  def change
    add_index :assessment_skills,
              %i[assessment_id skill_id],
              unique: true,
              where: 'skill_id IS NOT NULL',
              name: 'index_assessment_skills_on_assessment_and_taxonomy_skill'
  end
end
