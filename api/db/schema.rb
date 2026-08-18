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

ActiveRecord::Schema[7.0].define(version: 2026_08_18_193706) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pgcrypto"
  enable_extension "plpgsql"

  # Custom types defined in this database.
  # Note that some types may not work with other database engines. Be careful if changing database.
  create_enum "confidence_level", ["high", "medium", "low"]
  create_enum "coverage_state", ["not_yet", "initiated", "partial", "covered"]
  create_enum "end_reason", ["manual_candidate", "manual_assessor", "all_covered", "time_ceiling", "error"]
  create_enum "fit_result", ["match", "gap", "exceed", "not_assessed"]
  create_enum "generation_status", ["pending", "generating", "complete", "failed"]
  create_enum "session_status", ["pending", "active", "ended", "failed"]
  create_enum "speaker_type", ["ai", "candidate"]

  create_table "assessment_skills", force: :cascade do |t|
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

  create_table "assessments", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.bigint "created_by", null: false
    t.string "name", limit: 255, null: false
    t.integer "time_limit_min", null: false
    t.text "system_prompt"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "language", default: "en"
    t.index ["tenant_id"], name: "index_assessments_on_tenant_id"
    t.check_constraint "time_limit_min = ANY (ARRAY[10, 30, 45, 60, 90])", name: "chk_assessments_time_limit"
  end

  create_table "assessor_overrides", force: :cascade do |t|
    t.bigint "portfolio_skill_id", null: false
    t.integer "ai_level", null: false
    t.integer "override_level", null: false
    t.text "assessor_notes"
    t.bigint "overridden_by", null: false
    t.datetime "overridden_at", default: -> { "now()" }
    t.index ["portfolio_skill_id"], name: "index_assessor_overrides_on_portfolio_skill_id", unique: true
    t.check_constraint "ai_level >= 1 AND ai_level <= 5", name: "chk_overrides_ai_level"
    t.check_constraint "override_level >= 1 AND override_level <= 5", name: "chk_overrides_override_level"
  end

  create_table "coverage_maps", force: :cascade do |t|
    t.bigint "session_id", null: false
    t.string "skill_id", limit: 50
    t.string "skill_label", limit: 255, null: false
    t.boolean "is_discovered", default: false, null: false
    t.enum "state", default: "not_yet", null: false, enum_type: "coverage_state"
    t.integer "probe_count", default: 0, null: false
    t.text "last_signal"
    t.datetime "updated_at", default: -> { "now()" }
    t.index ["session_id", "skill_label"], name: "index_coverage_maps_on_session_id_and_skill_label", unique: true
    t.index ["session_id"], name: "idx_coverage_session"
    t.index ["session_id"], name: "index_coverage_maps_on_session_id"
  end

  create_table "fit_gap_reports", force: :cascade do |t|
    t.bigint "portfolio_id", null: false
    t.bigint "vacancy_id", null: false
    t.jsonb "skill_comparisons", null: false
    t.text "culture_narrative"
    t.text "overall_narrative"
    t.datetime "generated_at", default: -> { "now()" }
    t.index ["portfolio_id", "vacancy_id"], name: "index_fit_gap_reports_on_portfolio_id_and_vacancy_id", unique: true
    t.index ["portfolio_id"], name: "index_fit_gap_reports_on_portfolio_id"
    t.index ["vacancy_id"], name: "index_fit_gap_reports_on_vacancy_id"
  end

  create_table "organizations", force: :cascade do |t|
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

  create_table "portfolio_skills", force: :cascade do |t|
    t.bigint "portfolio_id", null: false
    t.string "skill_id", limit: 50
    t.string "skill_label", limit: 255, null: false
    t.boolean "is_discovered", default: false, null: false
    t.integer "ai_level", null: false
    t.enum "ai_confidence", null: false, enum_type: "confidence_level"
    t.jsonb "evidence", default: [], null: false
    t.text "competency_summary", null: false
    t.index ["portfolio_id"], name: "index_portfolio_skills_on_portfolio_id"
    t.check_constraint "ai_level >= 1 AND ai_level <= 5", name: "chk_portfolio_skills_ai_level"
  end

  create_table "portfolios", force: :cascade do |t|
    t.bigint "session_id", null: false
    t.bigint "candidate_id"
    t.enum "generation_status", default: "pending", null: false, enum_type: "generation_status"
    t.datetime "generated_at"
    t.text "generation_error"
    t.index ["candidate_id"], name: "index_portfolios_on_candidate_id"
    t.index ["session_id"], name: "index_portfolios_on_session_id", unique: true
  end

  create_table "sessions", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.bigint "assessment_id", null: false
    t.bigint "candidate_id"
    t.string "invite_token", limit: 64, null: false
    t.enum "status", default: "pending", null: false, enum_type: "session_status"
    t.enum "end_reason", enum_type: "end_reason"
    t.datetime "started_at"
    t.datetime "ended_at"
    t.integer "duration_seconds"
    t.text "gemini_resumption_token"
    t.datetime "created_at", default: -> { "now()" }, null: false
    t.string "candidate_name", limit: 255
    t.string "candidate_email"
    t.index ["assessment_id"], name: "index_sessions_on_assessment_id"
    t.index ["candidate_id"], name: "index_sessions_on_candidate_id"
    t.index ["invite_token"], name: "idx_sessions_invite_token", unique: true
    t.index ["tenant_id", "status"], name: "idx_sessions_tenant_status"
  end

  create_table "skill_taxonomies", force: :cascade do |t|
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

  create_table "transcript_turns", force: :cascade do |t|
    t.bigint "session_id", null: false
    t.integer "turn_number", null: false
    t.enum "speaker", null: false, enum_type: "speaker_type"
    t.text "text", null: false
    t.integer "audio_start_ms"
    t.integer "audio_end_ms"
    t.datetime "created_at", default: -> { "now()" }, null: false
    t.index ["session_id", "turn_number"], name: "idx_transcript_session", unique: true
    t.index ["session_id"], name: "index_transcript_turns_on_session_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", limit: 255, null: false
    t.string "password_digest", null: false
    t.string "role", limit: 20, default: "user", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "idx_ai_interview_users_email", unique: true
  end

  create_table "vacancies", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.bigint "created_by", null: false
    t.string "role_title", limit: 255, null: false
    t.text "culture_dimensions"
    t.text "competency_expectations"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["tenant_id"], name: "index_vacancies_on_tenant_id"
  end

  create_table "vacancy_skills", force: :cascade do |t|
    t.bigint "vacancy_id", null: false
    t.string "skill_id", limit: 50
    t.string "skill_label", limit: 255, null: false
    t.integer "expected_level", null: false
    t.index ["vacancy_id"], name: "index_vacancy_skills_on_vacancy_id"
    t.check_constraint "expected_level >= 1 AND expected_level <= 5", name: "chk_vacancy_skills_expected_level"
  end

  add_foreign_key "assessment_skills", "assessments"
  add_foreign_key "assessor_overrides", "portfolio_skills"
  add_foreign_key "coverage_maps", "sessions"
  add_foreign_key "fit_gap_reports", "portfolios"
  add_foreign_key "fit_gap_reports", "vacancies"
  add_foreign_key "portfolio_skills", "portfolios"
  add_foreign_key "portfolios", "sessions"
  add_foreign_key "sessions", "assessments"
  add_foreign_key "transcript_turns", "sessions"
  add_foreign_key "vacancy_skills", "vacancies"
end
