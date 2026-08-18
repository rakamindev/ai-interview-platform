# frozen_string_literal: true

class AddTenantIdToAssessmentSkills < ActiveRecord::Migration[7.0]
  def change
    add_column :assessment_skills, :tenant_id, :bigint
    add_index :assessment_skills, :tenant_id
  end
end
