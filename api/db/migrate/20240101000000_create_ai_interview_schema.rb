# frozen_string_literal: true

# Creates the ai_interview PostgreSQL schema and all AI Interview tables within it.
# Tables use tenant_id (references public.organizations.id) for multi-tenant scoping.
class CreateAiInterviewSchema < ActiveRecord::Migration[7.0]
  def up
    # Create dedicated schema
    execute "CREATE SCHEMA IF NOT EXISTS ai_interview"

    # Ensure the search path includes ai_interview
    execute "SET search_path TO ai_interview, public"

    enable_extension 'pgcrypto' unless extension_enabled?('pgcrypto')

    # ── ENUMs ──────────────────────────────────────────────────────────────────

    execute <<~SQL
      DO $$ BEGIN
        CREATE TYPE ai_interview.session_status AS ENUM ('pending', 'active', 'ended', 'failed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE ai_interview.end_reason AS ENUM
          ('manual_candidate', 'manual_assessor', 'all_covered', 'time_ceiling', 'error');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE ai_interview.speaker_type AS ENUM ('ai', 'candidate');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE ai_interview.coverage_state AS ENUM ('not_yet', 'initiated', 'partial', 'covered');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE ai_interview.generation_status AS ENUM ('pending', 'generating', 'complete', 'failed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE ai_interview.confidence_level AS ENUM ('high', 'medium', 'low');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE ai_interview.fit_result AS ENUM ('match', 'gap', 'exceed', 'not_assessed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    SQL

    # ── assessments ────────────────────────────────────────────────────────────

    create_table :assessments do |t|
      t.bigint   :tenant_id,      null: false   # references public.organizations.id
      t.bigint   :created_by,     null: false   # references users.id (in tenant schema)
      t.string   :name,           null: false, limit: 255
      t.integer  :time_limit_min, null: false
      t.text     :system_prompt
      t.timestamps null: false
    end

    add_index :assessments, :tenant_id

    execute <<~SQL
      ALTER TABLE ai_interview.assessments
        ADD CONSTRAINT chk_assessments_time_limit
        CHECK (time_limit_min IN (30, 45, 60, 90));
    SQL

    # ── assessment_skills ──────────────────────────────────────────────────────

    create_table :assessment_skills do |t|
      t.references :assessment, null: false, foreign_key: true
      t.string  :skill_id,      limit: 50
      t.string  :skill_label,   null: false, limit: 255
      t.boolean :is_custom,     null: false, default: false
      t.text    :scope_include
      t.text    :scope_exclude
      t.text    :l1_anchor,     null: false
      t.text    :l2_anchor,     null: false
      t.text    :l3_anchor,     null: false
      t.text    :l4_anchor,     null: false
      t.text    :l5_anchor,     null: false
      t.integer :expected_level
      t.integer :display_order, null: false, default: 0
    end

    execute <<~SQL
      ALTER TABLE ai_interview.assessment_skills
        ADD CONSTRAINT chk_assessment_skills_expected_level
        CHECK (expected_level BETWEEN 1 AND 5);
    SQL

    # ── sessions ───────────────────────────────────────────────────────────────

    create_table :sessions do |t|
      t.bigint   :tenant_id,   null: false
      t.references :assessment, null: false, foreign_key: true
      t.bigint   :candidate_id              # nullable: candidate may not have Rakamin account
      t.string   :invite_token, limit: 64, null: false
      t.column   :status,       'ai_interview.session_status', null: false, default: 'pending'
      t.column   :end_reason,   'ai_interview.end_reason'
      t.datetime :started_at,   precision: 6
      t.datetime :ended_at,     precision: 6
      t.integer  :duration_seconds
      t.text     :gemini_resumption_token
      t.datetime :created_at,   null: false, precision: 6, default: -> { "NOW()" }
    end

    add_index :sessions, :invite_token, unique: true, name: 'idx_sessions_invite_token'
    add_index :sessions, %i[tenant_id status], name: 'idx_sessions_tenant_status'

    # ── transcript_turns ───────────────────────────────────────────────────────

    create_table :transcript_turns do |t|
      t.references :session, null: false, foreign_key: true
      t.integer :turn_number, null: false
      t.column  :speaker,     'ai_interview.speaker_type', null: false
      t.text    :text,        null: false
      t.integer :audio_start_ms
      t.integer :audio_end_ms
      t.datetime :created_at, null: false, precision: 6, default: -> { "NOW()" }
    end

    add_index :transcript_turns, %i[session_id turn_number],
              unique: true,
              name: 'idx_transcript_session'

    # ── coverage_maps ──────────────────────────────────────────────────────────

    create_table :coverage_maps do |t|
      t.references :session,     null: false, foreign_key: true
      t.string     :skill_id,    limit: 50
      t.string     :skill_label, null: false, limit: 255
      t.boolean    :is_discovered, null: false, default: false
      t.column     :state,       'ai_interview.coverage_state', null: false, default: 'not_yet'
      t.integer    :probe_count, null: false, default: 0
      t.text       :last_signal
      t.datetime   :updated_at,  precision: 6, default: -> { "NOW()" }
    end

    add_index :coverage_maps, :session_id, name: 'idx_coverage_session'
    add_index :coverage_maps, %i[session_id skill_label], unique: true

    # ── portfolios ─────────────────────────────────────────────────────────────

    create_table :portfolios do |t|
      t.references :session,  null: false, foreign_key: true, index: { unique: true }
      t.bigint     :candidate_id
      t.column     :generation_status, 'ai_interview.generation_status',
                   null: false, default: 'pending'
      t.datetime   :generated_at,   precision: 6
      t.text       :generation_error
    end

    # ── portfolio_skills ───────────────────────────────────────────────────────

    create_table :portfolio_skills do |t|
      t.references :portfolio,   null: false, foreign_key: true
      t.string     :skill_id,    limit: 50
      t.string     :skill_label, null: false, limit: 255
      t.boolean    :is_discovered, null: false, default: false
      t.integer    :ai_level,    null: false
      t.column     :ai_confidence, 'ai_interview.confidence_level', null: false
      t.jsonb      :evidence,    null: false, default: []
      t.text       :competency_summary, null: false
    end

    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_ai_level
        CHECK (ai_level BETWEEN 1 AND 5);
    SQL

    # ── assessor_overrides ─────────────────────────────────────────────────────

    create_table :assessor_overrides do |t|
      t.references :portfolio_skill, null: false,
                   foreign_key: true, index: { unique: true }
      t.integer  :ai_level,       null: false
      t.integer  :override_level, null: false
      t.text     :assessor_notes
      t.bigint   :overridden_by,  null: false   # FK to users.id
      t.datetime :overridden_at,  precision: 6, default: -> { "NOW()" }
    end

    execute <<~SQL
      ALTER TABLE ai_interview.assessor_overrides
        ADD CONSTRAINT chk_overrides_ai_level
        CHECK (ai_level BETWEEN 1 AND 5);
      ALTER TABLE ai_interview.assessor_overrides
        ADD CONSTRAINT chk_overrides_override_level
        CHECK (override_level BETWEEN 1 AND 5);
    SQL

    # ── vacancies ──────────────────────────────────────────────────────────────

    create_table :vacancies do |t|
      t.bigint :tenant_id,  null: false
      t.bigint :created_by, null: false
      t.string :role_title, null: false, limit: 255
      t.text   :culture_dimensions
      t.text   :competency_expectations
      t.timestamps null: false
    end

    add_index :vacancies, :tenant_id

    # ── vacancy_skills ─────────────────────────────────────────────────────────

    create_table :vacancy_skills do |t|
      t.references :vacancy,     null: false, foreign_key: true
      t.string  :skill_id,       limit: 50
      t.string  :skill_label,    null: false, limit: 255
      t.integer :expected_level, null: false
    end

    execute <<~SQL
      ALTER TABLE ai_interview.vacancy_skills
        ADD CONSTRAINT chk_vacancy_skills_expected_level
        CHECK (expected_level BETWEEN 1 AND 5);
    SQL

    # ── fit_gap_reports ────────────────────────────────────────────────────────

    create_table :fit_gap_reports do |t|
      t.references :portfolio, null: false, foreign_key: true
      t.references :vacancy,   null: false, foreign_key: true
      t.jsonb :skill_comparisons, null: false
      t.text  :culture_narrative
      t.text  :overall_narrative
      t.datetime :generated_at, precision: 6, default: -> { "NOW()" }
    end

    add_index :fit_gap_reports, %i[portfolio_id vacancy_id], unique: true
  end

  def down
    execute "DROP SCHEMA IF EXISTS ai_interview CASCADE"
  end
end
