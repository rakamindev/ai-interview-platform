# frozen_string_literal: true

# A skill must be selectable only once per assessment / vacancy. Dedupes any
# legacy rows before enforcing the constraint (safe against existing data).
class AddUniqueSkillLabelIndexes < ActiveRecord::Migration[7.0]
  def up
    execute <<~SQL
      DELETE FROM assessment_skills a
      USING assessment_skills b
      WHERE a.assessment_id = b.assessment_id
        AND a.skill_label = b.skill_label
        AND a.id > b.id
    SQL
    execute <<~SQL
      DELETE FROM vacancy_skills a
      USING vacancy_skills b
      WHERE a.vacancy_id = b.vacancy_id
        AND a.skill_label = b.skill_label
        AND a.id > b.id
    SQL

    add_index :assessment_skills, %i[assessment_id skill_label],
              unique: true, name: 'idx_assessment_skills_unique_label'
    add_index :vacancy_skills, %i[vacancy_id skill_label],
              unique: true, name: 'idx_vacancy_skills_unique_label'
  end

  def down
    remove_index :assessment_skills, name: 'idx_assessment_skills_unique_label'
    remove_index :vacancy_skills, name: 'idx_vacancy_skills_unique_label'
  end
end
