# frozen_string_literal: true

class CreateVacancyVersions < ActiveRecord::Migration[7.0]
  def up
    execute 'SET search_path TO ai_interview, public'

    create_table :vacancy_versions do |t|
      t.references :vacancy, null: false, foreign_key: true, type: :bigint
      t.string :role_title, limit: 255, null: false
      t.text :culture_dimensions
      t.text :competency_expectations
      t.text :public_requirement_text
      t.jsonb :skills_snapshot, null: false, default: []
      t.datetime :created_at, null: false
    end
  end

  def down
    drop_table :vacancy_versions
  end
end
