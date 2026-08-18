# frozen_string_literal: true

class AddUniqueSkillIndexes < ActiveRecord::Migration[7.0]
  # DB-level duplicate guard for nested-assignment races — a model validation
  # cannot see duplicate in-memory siblings, so the database enforces it.
  def change
    add_index :assessment_skills, [:assessment_id, :skill_label],
              unique: true, name: 'idx_assessment_skills_unique_label'
    add_index :vacancy_skills, [:vacancy_id, :skill_label],
              unique: true, name: 'idx_vacancy_skills_unique_label'
  end
end