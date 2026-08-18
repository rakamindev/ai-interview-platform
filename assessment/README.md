# Assessment — Written Deliverables

This folder contains the written deliverables for the Fullstack Product Engineer case study.

## Pull Request

**PR #42** → https://github.com/rakamindev/ai-interview-platform/pull/42

Branch: `bsonow:feature/fitgap-portfolio-integrity-v2` → `rakamindev:main`

---

## Step 2: Deep Context & Domain Immersion

### The Product
AI-powered skills assessment platform for the Indonesian hiring market. Assessors configure skill taxonomies with L1–L5 behavioral anchors; candidates complete a live voice interview; Gemini Live AI probes skills naturally (not from a list); a portfolio is generated post-session; assessors run fit/gap analyses against job vacancies.

### The Industry
Indonesian hiring and talent assessment. Key challenges: inconsistent interview quality across interviewers, no structured evidence trail for hiring decisions, candidate volume outpacing assessor bandwidth. The platform's leverage point is producing *evidence-backed*, *reproducible* skill portfolios — not just impressions.

### What It Is For
The product exists to give recruiters and hiring managers a defensible, structured view of a candidate's competency level — with evidence from the actual interview, not self-reported skills.

### The Users
- **Assessors / HR leads**: configure assessments, invite candidates, review portfolios, run fit/gap analyses, override AI ratings
- **Hiring managers**: consume fit/gap reports to make decisions
- **Candidates**: complete the voice interview (no dashboard, no opt-out — design for them too)

### UU PDP Implications
- Candidate data (name, email, voice transcript, skill portfolio) is personal data under UU PDP
- No PII in logs or commits (enforced — `application.yml` gitignored)
- Migrations are reversible and safe against existing rows
- `candidate_email` stored only for identity resolution, not surfaced to candidates

---

## Step 3: Problem & Gap Analysis

### P0 — Critical (broken data / broken UI)

| # | Location | Type | Impact |
|---|---|---|---|
| BUG-1 | `FitGap::Engine` | Defective | `expected_level` key in JSONB never matched `required_level` in TS type → Required column always blank in ComparisonTable |
| BUG-2 | `FitGap::Engine` | Defective | `is_override` flag computed but never stored in `skill_comparisons` → human-override `✏` indicator never rendered |
| BUG-3 | `types/index.ts` | Defective | `PortfolioSkill.ai_level` declared `string` but API sends `number` |
| BUG-4 | `types/index.ts` | Defective | `skill_id` declared `number` but DB/API stores varchar |
| BUG-5 | `types/index.ts` | Missing spec | `SkillComparison.confidence` field not declared — Confidence column impossible to build |

### P1 — High

| # | Location | Type | Impact |
|---|---|---|---|
| BUG-6 | `Portfolio` model | Defective | `aborted` in DB enum but not in `GENERATION_STATUSES` — validation error on externally-set status |
| BUG-7 | DB constraint | Defective | `ai_level >= 0` but model validates 1..5 and generator clamps 1..5 — inconsistent contract |
| ARCH-1 | Session identity | Missing spec | Sessions only stored `candidate_name` — no reliable way to identify same candidate across retry sessions |
| ARCH-2 | Session lifecycle | Missing spec | No mechanism to invalidate pending sessions when candidate completes a newer session |

### P2 — Medium (UI/UX)

- FitGapReportPage rendered only one narrative (`||` swallowed the other)
- ComparisonTable had no Confidence column despite data being available
- InterviewPage complete state gave no feedback on portfolio generation status
- `invite_url` pointed to API port (3001) instead of web app port (5173)
- AssessmentInvitePage showed retried sessions as duplicate candidates

### Constraint Signal

**Architectural debt to escalate to Tech Lead:**
1. `Sessions::EndHandler` publishes to Redis synchronously inside `call` — if Redis is down, the session end fails. Should be async or at minimum wrapped with a circuit breaker.
2. `FitGapGeneratorWorker` does not handle Sidekiq retry exhaustion — a permanently failing Gemini call leaves `fit_gap_reports` in a missing state with no user-visible feedback.
3. `PortfolioGeneratorWorker` marks portfolio `failed` on any exception — this includes transient network errors that would succeed on retry. The retry strategy is not tuned.

---

## Step 4: Revamp Strategy & Trade-offs

### Acceptance Criteria (self-derived)

**FitGap Engine output:**
- `skill_comparisons[*].required_level` is always a number (1–5), matching `vacancy_skills.expected_level`
- `skill_comparisons[*].is_override` is `true` iff an `AssessorOverride` exists for that portfolio skill
- `skill_comparisons[*].confidence` reflects `portfolio_skill.ai_confidence`
- Old reports with `expected_level` key still render correctly (backward compat fallback in ComparisonTable)

**Session supersede:**
- When session A completes (`all_covered | manual_candidate | manual_assessor | time_ceiling`), all pending sessions for the same candidate (same `assessment_id`) are marked `status=ended, end_reason=superseded`
- Session failure (`error`) does NOT trigger supersede
- Identity resolution: `candidate_id` > `candidate_email` > nil (name never used)
- Cross-assessment and cross-tenant sessions are never affected

**Edge cases handled:**
- No identity info → no supersede (safe, no false positives)
- Session already ended → `EndHandler#call` returns early (idempotent)
- `candidate_email` normalised to lowercase + strip on write
- Old sessions without email → appear as individual candidate cards in UI (session_id as key)

### Option Evaluation

**BUG-1/2 fix — Option A: rename key in engine output**
- Rename `expected_level` → `required_level` in Ruby hash before JSONB storage
- ✅ One-line fix, source of truth stays in DB column name vocabulary
- ✅ Consistent with `vacancy_skills.expected_level` → "required for this role"
- ⚠ Old reports in DB have `expected_level` — backward compat needed in frontend

**BUG-1/2 fix — Option B: rename TypeScript type to `expected_level`**
- Change `required_level` → `expected_level` in TS interface
- ✅ No backend change
- ❌ `expected_level` is ambiguous (also exists on `assessment_skills` with different meaning)
- ❌ Less readable for UI — "required" is clearer for a recruiter

**Chosen: Option A** — rename in engine, add backward compat fallback in ComparisonTable (`c.required_level ?? c.expected_level`)

**Candidate identity — Option A: add `candidates` table**
- Full candidate entity with email, name, ID
- ✅ Clean data model, supports future profile features
- ❌ Requires migration, FK changes, new controller, new UI — overkill for scope

**Candidate identity — Option B: add `candidate_email` to sessions**
- Email stored per session, identity resolved client-side (frontend) and server-side (EndHandler)
- ✅ Minimal schema change, backward compatible (nullable)
- ✅ Sufficient for grouping and supersede logic
- ⚠ No deduplication enforcement — same candidate can have different emails across sessions (acceptable for now)

**Chosen: Option B** — `candidate_email` on sessions, identity priority `candidate_id > email > session_id`

---

## Step 5: Implementation Summary

See PR #42 for full diff. Key changes:

### Backend
- `api/app/services/fit_gap/engine.rb` — BUG-1+2 fix
- `api/app/models/portfolio.rb` — BUG-6 fix
- `api/db/migrate/20260817000000_*` — BUG-7 migration
- `api/db/migrate/20260818000000_*` — `candidate_email` + `superseded` enum
- `api/app/models/session.rb` — `superseded?`, `candidate_identity_key`
- `api/app/controllers/api/v1/sessions_controller.rb` — accept/return `candidate_email`
- `api/app/services/sessions/end_handler.rb` — supersede logic

### Frontend
- `web/src/types/index.ts` — all type fixes
- `web/src/components/fitgap/ComparisonTable.tsx` — Confidence column, backward compat
- `web/src/pages/fitgap/FitGapReportPage.tsx` — both narratives, error states, recommendation banner
- `web/src/pages/assessments/AssessmentInvitePage.tsx` — candidate-grouped cards, email field
- `web/src/pages/portfolio/PortfolioPage.tsx` — confidence summary, states
- `web/src/pages/interview/InterviewPage.tsx` — 2-step flow, portfolio polling

### Tests
- `api/spec/services/fit_gap/engine_spec.rb` — 22 examples
- `api/spec/services/portfolios/generator_spec.rb` — 13 examples
- `api/spec/services/sessions/end_handler_spec.rb` — 23 examples
- **Total: 58 examples, 0 failures**
- Seeded fault tests included for BUG-2 (`is_override`) and supersede logic

---

## AI Verification Moment

**Instance where AI generation was wrong and required correction:**

During factory setup for RSpec specs, the initial `assessment` factory used `association :organization` — but `Assessment` does not `belongs_to :organization`, it uses `tenant_id` (integer FK). The generated factory caused `NoMethodError: undefined method 'organization=' for an instance of Assessment` across all 35 specs.

**Correction**: Removed the `organization` association entirely from all factories, set `tenant_id: 1` directly as a static integer. This is the correct approach for `TenantScoped` models where the tenant is set via `Current.tenant_id` or a plain integer column, not a Rails association.

**Result**: All 35 specs passed after the correction. This was caught immediately by running the specs rather than trusting the generated factory structure.
