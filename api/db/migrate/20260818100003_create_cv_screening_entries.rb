# frozen_string_literal: true

# One row per uploaded CV within a batch. cv_file is attached via ActiveStorage
# (has_one_attached on the model) — no column here for it. Text extraction,
# scoring, and email detection are Phase 6 concerns; their columns land in a
# later migration when that pipeline is actually built, not pre-provisioned here.
class CreateCvScreeningEntries < ActiveRecord::Migration[7.0]
  def up
    execute 'SET search_path TO ai_interview, public'

    create_enum :cv_screening_decision, %w[pending needs_review invited not_advanced]

    create_table :cv_screening_entries do |t|
      t.bigint :tenant_id, null: false
      t.references :cv_screening_batch, null: false, foreign_key: true, type: :bigint
      t.string :detected_email, limit: 255
      t.enum :decision, enum_type: 'cv_screening_decision', null: false, default: 'pending'
      t.string :decision_reason, limit: 50
      t.timestamps null: false
    end

    add_index :cv_screening_entries, :tenant_id
    add_index :cv_screening_entries, :detected_email
  end

  def down
    drop_table :cv_screening_entries
    execute 'DROP TYPE IF EXISTS ai_interview.cv_screening_decision'
  end
end
