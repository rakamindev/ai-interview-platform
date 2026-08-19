# frozen_string_literal: true

class AddReviewWorkspaceSchema < ActiveRecord::Migration[7.0]
  def up
    execute <<~SQL
      DO $$ BEGIN
        CREATE TYPE ai_interview.portfolio_assessment_state AS ENUM ('assessed', 'not_assessed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    SQL

    add_column :portfolio_skills, :assessment_state,
               'ai_interview.portfolio_assessment_state', null: false, default: 'assessed'
    add_column :portfolio_skills, :evidence_turn_ids, :jsonb, null: false, default: []
    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :portfolio_skills, :ai_confidence, true

    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_assessment_state
        CHECK (
          (assessment_state = 'assessed' AND ai_level IS NOT NULL AND ai_confidence IS NOT NULL) OR
          (assessment_state = 'not_assessed' AND ai_level IS NULL AND ai_confidence IS NULL AND evidence = '[]'::jsonb AND evidence_turn_ids = '[]'::jsonb)
        );
    SQL

    create_table :transcript_revisions do |t|
      t.references :transcript_turn, null: false, foreign_key: true
      t.text :revised_text, null: false
      t.text :reason, null: false
      t.bigint :revised_by, null: false
      t.timestamps null: false
    end
    add_index :transcript_revisions, %i[transcript_turn_id created_at]

    create_table :interview_recordings do |t|
      t.references :session, null: false, foreign_key: true, index: { unique: true }
      t.string :object_key, null: false
      t.string :content_type, null: false
      t.integer :byte_size, null: false
      t.integer :duration_ms
      t.string :checksum, null: false
      t.datetime :captured_at, null: false
      t.datetime :expires_at, null: false
      t.datetime :purged_at
      t.timestamps
    end
    add_index :interview_recordings, :object_key, unique: true

    create_table :portfolio_notes do |t|
      t.references :portfolio, null: false, foreign_key: true
      t.text :body, null: false
      t.string :category, null: false, default: 'review'
      t.bigint :created_by, null: false
      t.timestamps
    end
  end

  def down
    drop_table :portfolio_notes
    drop_table :interview_recordings
    drop_table :transcript_revisions

    execute 'ALTER TABLE ai_interview.portfolio_skills DROP CONSTRAINT chk_portfolio_skills_assessment_state'
    change_column_null :portfolio_skills, :ai_confidence, false
    change_column_null :portfolio_skills, :ai_level, false
    remove_column :portfolio_skills, :evidence_turn_ids
    remove_column :portfolio_skills, :assessment_state
    execute 'DROP TYPE IF EXISTS ai_interview.portfolio_assessment_state'
  end
end
