# frozen_string_literal: true

class CreateCvScreenings < ActiveRecord::Migration[7.0]
  def up
    execute 'SET search_path TO ai_interview, public'

    create_table :cv_screenings do |t|
      t.bigint :tenant_id, null: false
      t.bigint :created_by, null: false
      t.string :name, limit: 255, null: false
      t.references :vacancy, null: false, foreign_key: true, type: :bigint
      t.references :assessment, null: false, foreign_key: true, type: :bigint
      t.integer :threshold
      t.timestamps null: false
    end

    add_index :cv_screenings, :tenant_id

    execute <<~SQL
      ALTER TABLE ai_interview.cv_screenings
        ADD CONSTRAINT chk_cv_screenings_threshold
        CHECK (threshold IS NULL OR threshold BETWEEN 0 AND 100);
    SQL
  end

  def down
    drop_table :cv_screenings
  end
end
