# frozen_string_literal: true

class CreateSkillTaxonomies < ActiveRecord::Migration[7.0]
    def up
        execute 'SET search_path TO ai_interview, public'

        create_table :skill_taxonomies do |t|
            t.string :skill_id, null: false, limit: 50
            t.string :skill_label, null: false, limit: 255
            t.string :category, null: false, limit: 50
            t.text :scope_include
            t.text :scope_exclude
            t.text :l1_anchor, null: false
            t.text :l2_anchor, null: false
            t.text :l3_anchor, null: false
            t.text :l4_anchor, null: false
            t.text :l5_anchor, null: false
        end

        add_index :skill_taxonomies, :skill_id, unique: true, name: 'idx_skill_taxonomies_skill_id'
        add_index :skill_taxonomies, :category, name: 'idx_skill_taxonomies_category'
    end

    def down
        drop_table :skill_taxonomies
    end
end
