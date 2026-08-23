# frozen_string_literal: true

# Single source of truth for API response key-sets.
#
# Used by:
#   - Contract specs (spec/requests/api/v1/response_format_spec.rb)
#   - Serializer unit specs (spec/serializers/)
#
# When intentionally changing an API contract, update it HERE first,
# ideally with a version path bump (/api/v1 → /api/v2).
module ResponseContracts
  # ── Shared fragments ──────────────────────────────────────────────────────
  SKILL_ANCHOR_KEYS = %i[l1_anchor l2_anchor l3_anchor l4_anchor l5_anchor].freeze

  PAGINATION_META_KEYS = %i[current_page total_pages total_count per_page].freeze

  # ── Assessments ───────────────────────────────────────────────────────────
  ASSESSMENT_KEYS       = %i[id name time_limit_min language created_by
                             created_at updated_at latest_session].freeze
  ASSESSMENT_SKILL_KEYS = (%i[id skill_id skill_label is_custom
                              scope_include scope_exclude expected_level
                              display_order] + SKILL_ANCHOR_KEYS).freeze
  LATEST_SESSION_KEYS   = %i[id status end_reason].freeze

  # ── Sessions ──────────────────────────────────────────────────────────────
  SESSION_KEYS                 = %i[id assessment_id tenant_id candidate_id candidate_name
                                    invite_token invite_url status end_reason started_at
                                    ended_at duration_seconds created_at].freeze
  SESSION_WITH_ASSESSMENT_KEYS = (SESSION_KEYS + [:assessment]).freeze
  SESSION_ASSESSMENT_SUMMARY_KEYS = %i[id name time_limit_min].freeze

  COVERAGE_MAP_KEYS    = %i[id skill_id skill_label is_discovered state
                            probe_count last_signal updated_at].freeze
  TRANSCRIPT_TURN_KEYS = %i[id turn_number speaker text audio_start_ms
                            audio_end_ms created_at].freeze

  # ── Vacancies ─────────────────────────────────────────────────────────────
  VACANCY_KEYS        = %i[id role_title culture_dimensions competency_expectations
                           created_by created_at updated_at].freeze
  VACANCY_SKILL_KEYS  = (%i[id skill_id skill_label expected_level] +
                         SKILL_ANCHOR_KEYS).freeze

  # ── Portfolios ────────────────────────────────────────────────────────────
  PORTFOLIO_KEYS       = %i[id session_id candidate_id generation_status
                            generated_at generation_error skills overrides].freeze
  PORTFOLIO_SKILL_KEYS = %i[id skill_id skill_label is_discovered ai_level
                            ai_confidence evidence competency_summary].freeze
  OVERRIDE_KEYS        = %i[id portfolio_skill_id ai_level override_level
                            assessor_notes overridden_by overridden_at].freeze
  FIT_GAP_REPORT_KEYS  = %i[id portfolio_id vacancy_id skill_comparisons
                            culture_narrative overall_narrative generated_at].freeze

  # ── Skill taxonomy ────────────────────────────────────────────────────────
  TAXONOMY_KEYS = (%i[skill_id skill_label category scope_include scope_exclude] +
                   SKILL_ANCHOR_KEYS).freeze
end

RSpec.configure do |config|
  config.include ResponseContracts
end
