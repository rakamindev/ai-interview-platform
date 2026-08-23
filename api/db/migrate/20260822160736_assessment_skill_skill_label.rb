class AssessmentSkillSkillLabel < ActiveRecord::Migration[7.0]
  def change
    add_column :assessment_skills, :skill_label, :string
  end
end
