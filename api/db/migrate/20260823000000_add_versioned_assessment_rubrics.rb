# frozen_string_literal: true

class AddVersionedAssessmentRubrics < ActiveRecord::Migration[7.0]
  def change
    add_column :assessments, :rubric_version, :integer, null: false, default: 1

    create_table :assessment_versions do |t|
      t.references :assessment, null: false, foreign_key: true
      t.integer :rubric_version, null: false
      t.string :name, null: false, limit: 255
      t.integer :time_limit_min, null: false
      t.string :language, null: false, default: 'en', limit: 10
      t.text :system_prompt, null: false
      t.datetime :created_at, null: false, default: -> { 'NOW()' }
    end

    add_index :assessment_versions, %i[assessment_id rubric_version], unique: true,
                                                                name: 'idx_assessment_versions_revision'
    add_check_constraint :assessment_versions, 'rubric_version >= 1', name: 'chk_assessment_versions_revision'
    add_check_constraint :assessment_versions,
                         'time_limit_min = ANY (ARRAY[10, 30, 45, 60, 90])',
                         name: 'chk_assessment_versions_time_limit'

    create_table :assessment_version_skills do |t|
      t.references :assessment_version, null: false, foreign_key: true
      t.string :skill_id, limit: 50
      t.string :skill_label, null: false, limit: 255
      t.boolean :is_custom, null: false, default: false
      t.text :scope_include
      t.text :scope_exclude
      t.text :l1_anchor, null: false
      t.text :l2_anchor, null: false
      t.text :l3_anchor, null: false
      t.text :l4_anchor, null: false
      t.text :l5_anchor, null: false
      t.integer :expected_level, null: false
      t.integer :display_order, null: false, default: 0
    end

    add_index :assessment_version_skills, %i[assessment_version_id display_order],
                                              unique: true,
                                              name: 'idx_assessment_version_skills_order'
    add_check_constraint :assessment_version_skills,
                         'expected_level BETWEEN 1 AND 5',
                         name: 'chk_assessment_version_skills_expected_level'

    add_reference :sessions, :assessment_version, foreign_key: true, null: true
  end
end
