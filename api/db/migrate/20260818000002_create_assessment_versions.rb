# frozen_string_literal: true

class CreateAssessmentVersions < ActiveRecord::Migration[7.0]
  def up
    execute 'SET search_path TO ai_interview, public'

    create_table :assessment_versions do |t|
      t.references :assessment, null: false, foreign_key: true, type: :bigint
      t.string :name, limit: 255, null: false
      t.integer :time_limit_min, null: false
      t.string :language, default: 'en'
      t.jsonb :skills_snapshot, null: false, default: []
      t.datetime :created_at, null: false
    end
  end

  def down
    drop_table :assessment_versions
  end
end
