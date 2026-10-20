# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_10_20_000000) do
  create_schema "ai_interview"

  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"
  enable_extension "pgcrypto"

  # Custom types defined in this database.
  # Note that some types may not work with other database engines. Be careful if changing database.
  create_enum "ai_interview.confidence_level", ["high", "medium", "low"]
  create_enum "ai_interview.coverage_state", ["not_yet", "initiated", "partial", "covered"]
  create_enum "ai_interview.end_reason", ["manual_candidate", "manual_assessor", "all_covered", "time_ceiling", "error"]
  create_enum "ai_interview.fit_result", ["match", "gap", "exceed", "not_assessed"]
  create_enum "ai_interview.generation_status", ["pending", "generating", "complete", "failed"]
  create_enum "ai_interview.session_status", ["pending", "active", "ended", "failed"]
  create_enum "ai_interview.speaker_type", ["ai", "candidate"]

  create_table "ai_interview.assessment_skills", force: :cascade do |t|
    t.bigint "assessment_id", null: false
    t.string "skill_id", limit: 50
    t.string "skill_label", limit: 255, null: false
    t.boolean "is_custom", default: false, null: false
    t.text "scope_include"
    t.text "scope_exclude"
    t.text "l1_anchor", null: false
    t.text "l2_anchor", null: false
    t.text "l3_anchor", null: false
    t.text "l4_anchor", null: false
    t.text "l5_anchor", null: false
    t.integer "expected_level"
    t.integer "display_order", default: 0, null: false
    t.index ["assessment_id"], name: "index_assessment_skills_on_assessment_id"
    t.check_constraint "expected_level >= 1 AND expected_level <= 5", name: "chk_assessment_skills_expected_level"
  end

  create_table "ai_interview.assessments", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.bigint "created_by", null: false
    t.string "name", limit: 255, null: false
    t.integer "time_limit_min", null: false
    t.text "system_prompt"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "language", default: "en"
    t.boolean "proctoring_required", default: false, null: false
    t.index ["tenant_id"], name: "index_assessments_on_tenant_id"
    t.check_constraint "time_limit_min = ANY (ARRAY[10, 30, 45, 60, 90])", name: "chk_assessments_time_limit"
  end

  create_table "ai_interview.assessor_overrides", force: :cascade do |t|
    t.bigint "portfolio_skill_id", null: false
    t.integer "ai_level"
    t.integer "override_level", null: false
    t.text "assessor_notes"
    t.bigint "overridden_by", null: false
    t.datetime "overridden_at", default: -> { "now()" }
    t.index ["portfolio_skill_id"], name: "index_assessor_overrides_on_portfolio_skill_id", unique: true
    t.check_constraint "ai_level >= 1 AND ai_level <= 5", name: "chk_overrides_ai_level"
    t.check_constraint "override_level >= 1 AND override_level <= 5", name: "chk_overrides_override_level"
  end

  create_table "ai_interview.coverage_maps", force: :cascade do |t|
    t.bigint "session_id", null: false
    t.string "skill_id", limit: 50
    t.string "skill_label", limit: 255, null: false
    t.boolean "is_discovered", default: false, null: false
    t.enum "state", default: "not_yet", null: false, enum_type: "ai_interview.coverage_state"
    t.integer "probe_count", default: 0, null: false
    t.text "last_signal"
    t.datetime "updated_at", default: -> { "now()" }
    t.index ["session_id", "skill_label"], name: "index_coverage_maps_on_session_id_and_skill_label", unique: true
    t.index ["session_id"], name: "idx_coverage_session"
    t.index ["session_id"], name: "index_coverage_maps_on_session_id"
  end

  create_table "ai_interview.fit_gap_reports", force: :cascade do |t|
    t.bigint "portfolio_id", null: false
    t.bigint "vacancy_id", null: false
    t.jsonb "skill_comparisons", null: false
    t.text "culture_narrative"
    t.text "overall_narrative"
    t.datetime "generated_at", default: -> { "now()" }
    t.string "generation_status", limit: 20, default: "complete", null: false
    t.datetime "requested_at"
    t.index ["portfolio_id", "vacancy_id"], name: "index_fit_gap_reports_on_portfolio_id_and_vacancy_id", unique: true
    t.index ["portfolio_id"], name: "index_fit_gap_reports_on_portfolio_id"
    t.index ["vacancy_id"], name: "index_fit_gap_reports_on_vacancy_id"
    t.check_constraint "generation_status::text = ANY (ARRAY['generating'::character varying, 'complete'::character varying]::text[])", name: "chk_fit_gap_reports_generation_status"
  end

  create_table "ai_interview.portfolio_skills", force: :cascade do |t|
    t.bigint "portfolio_id", null: false
    t.string "skill_id", limit: 50
    t.string "skill_label", limit: 255, null: false
    t.boolean "is_discovered", default: false, null: false
    t.integer "ai_level"
    t.enum "ai_confidence", enum_type: "ai_interview.confidence_level"
    t.jsonb "evidence", default: [], null: false
    t.text "competency_summary"
    t.string "not_assessed_reason", limit: 30
    t.index ["portfolio_id"], name: "index_portfolio_skills_on_portfolio_id"
    t.check_constraint "(ai_level IS NULL) = (not_assessed_reason IS NOT NULL)", name: "chk_portfolio_skills_reason_iff_no_level"
    t.check_constraint "ai_level >= 1 AND ai_level <= 5", name: "chk_portfolio_skills_ai_level"
    t.check_constraint "ai_level IS NOT NULL OR ai_confidence IS NULL", name: "chk_portfolio_skills_no_confidence_without_level"
    t.check_constraint "not_assessed_reason IS NULL OR (not_assessed_reason::text = ANY (ARRAY['not_reached'::character varying, 'insufficient_evidence'::character varying, 'omitted_by_model'::character varying]::text[]))", name: "chk_portfolio_skills_not_assessed_reason"
  end

  create_table "ai_interview.portfolios", force: :cascade do |t|
    t.bigint "session_id", null: false
    t.bigint "candidate_id"
    t.enum "generation_status", default: "pending", null: false, enum_type: "ai_interview.generation_status"
    t.datetime "generated_at"
    t.text "generation_error"
    t.string "generation_error_category", limit: 50
    t.index ["candidate_id"], name: "index_portfolios_on_candidate_id"
    t.index ["session_id"], name: "index_portfolios_on_session_id", unique: true
  end

  create_table "ai_interview.sessions", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.bigint "assessment_id", null: false
    t.bigint "candidate_id"
    t.string "invite_token", limit: 64, null: false
    t.enum "status", default: "pending", null: false, enum_type: "ai_interview.session_status"
    t.enum "end_reason", enum_type: "ai_interview.end_reason"
    t.datetime "started_at"
    t.datetime "ended_at"
    t.integer "duration_seconds"
    t.text "gemini_resumption_token"
    t.datetime "created_at", default: -> { "now()" }, null: false
    t.string "candidate_name", limit: 255
    t.jsonb "proctoring_events", default: [], null: false
    t.datetime "ending_requested_at"
    t.index ["assessment_id"], name: "index_sessions_on_assessment_id"
    t.index ["candidate_id"], name: "index_sessions_on_candidate_id"
    t.index ["invite_token"], name: "idx_sessions_invite_token", unique: true
    t.index ["tenant_id", "status"], name: "idx_sessions_tenant_status"
  end

  create_table "ai_interview.skill_taxonomies", force: :cascade do |t|
    t.string "skill_id", limit: 50, null: false
    t.string "skill_label", limit: 255, null: false
    t.string "category", limit: 50, null: false
    t.text "scope_include"
    t.text "scope_exclude"
    t.text "l1_anchor", null: false
    t.text "l2_anchor", null: false
    t.text "l3_anchor", null: false
    t.text "l4_anchor", null: false
    t.text "l5_anchor", null: false
    t.index ["category"], name: "idx_skill_taxonomies_category"
    t.index ["skill_id"], name: "idx_skill_taxonomies_skill_id", unique: true
  end

  create_table "ai_interview.transcript_turns", force: :cascade do |t|
    t.bigint "session_id", null: false
    t.integer "turn_number", null: false
    t.enum "speaker", null: false, enum_type: "ai_interview.speaker_type"
    t.text "text", null: false
    t.integer "audio_start_ms"
    t.integer "audio_end_ms"
    t.datetime "created_at", default: -> { "now()" }, null: false
    t.index ["session_id", "turn_number"], name: "idx_transcript_session", unique: true
    t.index ["session_id"], name: "index_transcript_turns_on_session_id"
  end

  create_table "ai_interview.users", force: :cascade do |t|
    t.string "email", limit: 255, null: false
    t.string "password_digest", null: false
    t.string "role", limit: 20, default: "user", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "idx_ai_interview_users_email", unique: true
  end

  create_table "ai_interview.vacancies", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.bigint "created_by", null: false
    t.string "role_title", limit: 255, null: false
    t.text "culture_dimensions"
    t.text "competency_expectations"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["tenant_id"], name: "index_vacancies_on_tenant_id"
  end

  create_table "ai_interview.vacancy_skills", force: :cascade do |t|
    t.bigint "vacancy_id", null: false
    t.string "skill_id", limit: 50
    t.string "skill_label", limit: 255, null: false
    t.integer "expected_level", null: false
    t.index ["vacancy_id"], name: "index_vacancy_skills_on_vacancy_id"
    t.check_constraint "expected_level >= 1 AND expected_level <= 5", name: "chk_vacancy_skills_expected_level"
  end

  add_foreign_key "ai_interview.assessment_skills", "ai_interview.assessments"
  add_foreign_key "ai_interview.assessor_overrides", "ai_interview.portfolio_skills"
  add_foreign_key "ai_interview.coverage_maps", "ai_interview.sessions"
  add_foreign_key "ai_interview.fit_gap_reports", "ai_interview.portfolios"
  add_foreign_key "ai_interview.fit_gap_reports", "ai_interview.vacancies"
  add_foreign_key "ai_interview.portfolio_skills", "ai_interview.portfolios"
  add_foreign_key "ai_interview.portfolios", "ai_interview.sessions"
  add_foreign_key "ai_interview.sessions", "ai_interview.assessments"
  add_foreign_key "ai_interview.transcript_turns", "ai_interview.sessions"
  add_foreign_key "ai_interview.vacancy_skills", "ai_interview.vacancies"

  create_table "public.organizations", force: :cascade do |t|
    t.string "name", limit: 255, null: false
    t.string "scheme", limit: 255, null: false
    t.string "identifier", limit: 255, null: false
    t.string "host", limit: 255, null: false
    t.string "alias_hosts", default: [], null: false, array: true
    t.jsonb "config", default: {}, null: false
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.timestamptz "updated_at", default: -> { "now()" }, null: false
    t.index ["host"], name: "index_organizations_on_host"
    t.index ["scheme"], name: "index_organizations_on_scheme", unique: true
  end
end
