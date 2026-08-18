# frozen_string_literal: true

# A batch snapshots vacancy_id/assessment_id/vacancy_version_id/threshold at UPLOAD
# time — the mechanism that satisfies FR4 (a batch keeps scoring against the vacancy
# state it was uploaded against, even if the vacancy is edited later).
class CreateCvScreeningBatches < ActiveRecord::Migration[7.0]
  def up
    execute 'SET search_path TO ai_interview, public'

    create_table :cv_screening_batches do |t|
      t.bigint :tenant_id, null: false
      t.references :cv_screening, null: false, foreign_key: true, type: :bigint
      t.references :vacancy, null: false, foreign_key: true, type: :bigint
      t.references :assessment, null: false, foreign_key: true, type: :bigint
      t.references :vacancy_version, foreign_key: true, type: :bigint
      t.integer :threshold
      t.bigint :created_by, null: false
      t.datetime :created_at, null: false
    end

    add_index :cv_screening_batches, :tenant_id

    execute <<~SQL
      ALTER TABLE ai_interview.cv_screening_batches
        ADD CONSTRAINT chk_cv_screening_batches_threshold
        CHECK (threshold IS NULL OR threshold BETWEEN 0 AND 100);
    SQL
  end

  def down
    drop_table :cv_screening_batches
  end
end
