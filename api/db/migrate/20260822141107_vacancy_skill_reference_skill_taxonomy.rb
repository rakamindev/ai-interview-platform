class VacancySkillReferenceSkillTaxonomy < ActiveRecord::Migration[7.0]
  def change
    add_reference :vacancy_skills, :skill_taxonomy, foreign_key: true
    remove_column :vacancy_skills, :skill_label, :string
    remove_column :vacancy_skills, :skill_id, :string
  end
end
