# frozen_string_literal: true

# Tenant-scoped library of reusable custom skills. Skills created while
# building an assessment are persisted here so they show up in the picker of
# every future assessment in the same tenant.
class CreateCustomSkills < ActiveRecord::Migration[7.0]
  def change
    create_table :custom_skills do |t|
      t.bigint :tenant_id, null: false
      t.bigint :created_by, null: false
      t.string :skill_label, limit: 255, null: false
      t.text :scope_include
      t.text :scope_exclude
      t.text :l1_anchor, null: false
      t.text :l2_anchor, null: false
      t.text :l3_anchor, null: false
      t.text :l4_anchor, null: false
      t.text :l5_anchor, null: false
      t.timestamps
    end

    add_index :custom_skills, :tenant_id
    add_index :custom_skills, %i[tenant_id skill_label], unique: true, name: 'idx_custom_skills_unique_label'
  end
end
