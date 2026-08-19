# API List vs Detail Contracts

Every core resource has two JSON shapes: a **list** projection (used by index
endpoints, sized for grids) and a **detail** projection (used by show endpoints,
sized for a single record). These shapes are locked by contract request specs
under `api/spec/requests/api/v1/*_contract_spec.rb` — a change to any key listed
below fails the suite on purpose, so frontend/backend drift is caught in CI
instead of shipping (see `assessment/engineering/recommendations.md` → REL-4).

If a contract spec fails, update this doc and the spec together — they must
never disagree.

## Assessments

| | List (`GET /api/v1/assessments`) | Detail (`GET /api/v1/assessments/:id`) |
|---|---|---|
| Base keys | `id`, `name`, `role_title`, `time_limit_min`, `language`, `created_by`, `created_at`, `updated_at`, `latest_session{id,status,end_reason}` | same base keys |
| `system_prompt` | **omitted** — the list UI never renders it; clients use `GET /assessments/:id/system_prompt` | included |
| `skills[]` | **omitted** — the list UI does not consume skills; the detail endpoint is the skills source | included, per-skill: `id`, `skill_id`, `skill_label`, `is_custom`, `scope_include`, `scope_exclude`, `l1_anchor`–`l5_anchor`, `expected_level`, `display_order` |

## Vacancies

| | List (`GET /api/v1/vacancies`) | Detail (`GET /api/v1/vacancies/:id`) |
|---|---|---|
| Base keys | `id`, `role_title`, `culture_dimensions`, `competency_expectations`, `created_by`, `created_at`, `updated_at` | same base keys |
| `skills[]` | summary only: `id`, `skill_id`, `skill_label`, `expected_level` (renders chips + search-by-skill, no per-vacancy taxonomy query) | full: summary keys + `l1_anchor`–`l5_anchor` (from `SkillTaxonomy`) |

## Sessions

| | List (`GET /api/v1/assessments/:assessment_id/sessions`) | Detail (`GET /api/v1/sessions/:id`) |
|---|---|---|
| Session keys | `id`, `assessment_id`, `tenant_id`, `candidate_id`, `candidate_name`, `invite_token`, `invite_url`, `status`, `end_reason`, `started_at`, `ended_at`, `duration_seconds`, `expires_at`, `revoked_at`, `revoked`, `expired`, `created_at` | same session keys |
| Embedded `assessment` | **omitted** — the list already scopes to one assessment and rendering it per row would add an N+1 | included: `id`, `name`, `role_title`, `time_limit_min` |

## Portfolios

No index route exists — `GET /api/v1/sessions/:id/portfolio` is the only shape:

- Base: `id`, `session_id`, `candidate_id`, `generation_status`, `generated_at`, `generation_error`, `skills[]`, `overrides[]`
- `skills[]`: `id`, `skill_id`, `skill_label`, `is_discovered`, `ai_level`, `ai_confidence`, `evidence`, `competency_summary`
- `overrides[]`: `id`, `portfolio_skill_id`, `ai_level`, `override_level`, `assessor_notes`, `overridden_by`, `overridden_at`
- While generation is pending/in progress: HTTP 202 `{"status": "generating"}`

## Change process

Changing any locked shape (adding, removing, or renaming a key) requires:
1. Updating the corresponding `*_contract_spec.rb` **and** the rows above in the
   same change, so the suite stays green and the doc matches the code.
2. Updating frontend consumers of the shape, and the OpenSpec capability spec
   (`openspec/specs/api-contracts/spec.md` after archive).
