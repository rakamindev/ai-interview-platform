# 02 · Problem & Gap Analysis

> Brief Step 3. Every finding was either **reproduced live** (two interview sessions on 2026-10-20, database records, API payloads, server/worker logs) or **verified in code** at the cited line. Paths are relative to `api/` or `web/`.

**Severity scale**
- **P0** — produces wrong hiring evidence or exposes another tenant's candidate data. Blocks release.
- **P1** — harms a candidate or user workflow in a common path, or breaks a legal obligation. Fix before scale.
- **P2** — real defect with a narrower path or a workaround.
- **P3** — setup, docs, or polish.

**Type:** **MS** = missing specification (behavior never defined) · **DI** = defective implementation (defined but broken).
**Status:** **In scope** = fixed by this PR (see `03-strategy.md`) · **Escalated** = logged with a proposed fix, not changed here.

## Summary

| ID | P | Type | Area | Finding | Impact (one line) | Status |
|---|---|---|---|---|---|---|
| F-001 | P0 | MS+DI | api → web | Unassessed skills are stored as **L1** | Candidates are scored on questions nobody asked, and it reads as a real weakness. | In scope |
| F-002 | P0 | DI | web ↔ api | Fit/gap screen reads fields the API never sends; recommendation hidden | Hiring decisions are made on a table with a blank "Required" column and invisible overrides. | In scope |
| F-003 | P0 | DI | api | Cross-tenant access to portfolios, exports, fit/gap and overrides | Any assessor can read or alter another company's candidate evaluations by incrementing an id. | In scope (endpoints touched) |
| F-004 | P0 | DI | api | Tenant resolved from client-controlled input; login lets caller pick tenant | Any valid token can act inside any tenant. | Escalated |
| F-005 | P1 | MS | api → web | Recommendation ignores confidence and interview completeness | A 3-minute, candidate-ended interview produced "do not recommend proceeding." | In scope |
| F-006 | P1 | DI | api | Closing-phrase fallback ends sessions as `all_covered` with nothing covered | Interviews are cut short and mislabeled as complete. | Escalated |
| F-007 | P1 | DI | web | Network check under-reports speed 8× and blocks with no bypass | Candidates on normal connections can't start an interview they were invited to. | Escalated |
| F-008 | P1 | DI | api | Gemini failures are swallowed; HTTP retries never fire | Coverage silently stays empty; the monitor and the AI interviewer run blind. | In scope (partial) |
| F-009 | P1 | DI | api + web | Retry allowed while retries are pending → concurrent duplicate generation | Duplicate skills, and assessor overrides can be silently deleted. | In scope |
| F-010 | P1 | DI | web | Every candidate failure path ends on "Interview Complete — recorded" | Candidates believe they finished when nothing usable was recorded; nobody re-invites them. | Escalated |
| F-011 | P1 | DI | api | PDF export crashes whenever an override exists | The deliverable fails exactly when an assessor has reviewed the portfolio. | In scope |
| F-012 | P1 | MS+DI | api + web | Generation states that never resolve (stuck `generating`, no fit/gap status, empty vacancy) | Users wait on infinite spinners with no error or recovery. | In scope |
| F-013 | P1 | DI | api | Model output parsed unsafely ("L3" → L1, case-sensitive confidence, unreconciled skill list) | Levels and confidence shown to assessors can be systematically wrong. | In scope |
| F-014 | P1 | MS | web + api | No consent/notice, no retention or deletion, undisclosed transfer to Gemini | Voice is recorded and AI-profiled without a lawful basis under UU PDP. | Escalated |
| F-015 | P1 | DI | api | Personal data in logs (transcripts at INFO, unfiltered params) | Candidate speech, names and passwords land in production logs. | Escalated |
| F-016 | P2 | DI | web | Duplicate `id="level-N"` in `LevelRadio` | Clicking a level label changes a *different* skill's level or override. | In scope |
| F-017 | P2 | DI | web | Removing a skill in edit forms never sends `_destroy` | "Deleted" skills keep being assessed and compared. | Escalated |
| F-018 | P2 | DI | api | Coverage state machine: blind auto-promotion, races, final turns dropped | Coverage over- or under-states what was assessed and drives early ends. | Escalated |
| F-019 | P2 | DI | web | Wrong-password 401 forces a reload to `/login` | Login errors are never shown. | Escalated |
| F-020 | P2 | DI | api | Invite tokens never expire; token holder can force `all_covered` | Long-lived bearer access and a coverage-check bypass. | Escalated |
| F-021 | P2 | DI | api | Interview control token hardcoded in repo and prompt (`SYS-TC-7x9k`) | Anyone with the repo can spoof time-control signals in a live interview. | Escalated |
| F-022 | P2 | MS | api | No rate limits on WebSockets or Gemini-triggering endpoints; unbounded text inputs | Cost abuse and denial of service; oversized input returns 500. | Escalated |
| F-023 | P2 | DI | infra | Dev/test DB names point at the shared `rakamin_*` databases | `db:test:prepare` would purge the other service's test database. | Fixed (setup) |
| F-030 | P0 | DI | infra | The API cannot boot in production | Every request fails: the release as shipped would not start. | Fixed (outside the slice: release blocker, needed for CI) |
| F-024 | P2 | DI | infra | Sample Gemini models are retired; REST client pinned to `v1` | A fresh deploy from the sample config fails every Gemini call. | Escalated |
| F-025 | P3 | MS | api + web | No seeded login user; signup page is dead code | Local setup can't log in without minting a token by hand. | Escalated |
| F-026 | P3 | DI | infra | `api/bin/*` committed without the executable bit | `bin/rails` fails with "permission denied". | Escalated |
| F-027 | P3 | DI | docs | Port and URL mismatches (web defaults to 3000, API serves 3001; invite links point at the API) | New contributors get broken requests and broken invite links. | Escalated |
| F-028 | P3 | DI | api | Deleting an assessment reports success when it was blocked | Users believe data was deleted when it wasn't. | Escalated |
| F-029 | P3 | DI | web | Lists only ever load page 1 | Vacancies beyond the first 20 can't be chosen for fit/gap. | Escalated |
| F-031 | P3 | MS | api | Fit/gap reports go stale when a vacancy changes | A recruiter can read a comparison against requirements that no longer exist. | Escalated |

---

## P0

### F-001 · Unassessed skills are stored as L1 — MS + DI · api → web
**Evidence (live, session 1).** "Mobile Development" was mentioned in one sentence. The AI's own summary: *"No detailed discussion… was provided, limiting the assessment to L1."* Stored: `ai_level = 1, ai_confidence = low`.
**Root cause, by seam:**
- *Prompt* asks for a level for **every** skill and offers no "insufficient evidence" option — `app/services/portfolios/generator.rb:81-100`.
- *Parser* `skill_data['level'].to_i.clamp(1, 5)` turns `null`, `"N/A"`, `"L3"` into 1 — `generator.rb:161,173`.
- *Schema* cannot represent it: `portfolio_skills.ai_level` is `NOT NULL` with `CHECK 1..5` — `db/schema.rb:115`. The model repeats the rule: `validates :ai_level, numericality: { in: 1..5 }` — `app/models/portfolio_skill.rb:10`.
- *Fit/gap* then reports the fake L1 as a **gap** — `app/services/fit_gap/engine.rb:49-50`.
- *Frontend* repeats the pattern: `parseLevel` falls back to 1 — `web/src/utils/constants.ts:4-8`.
**Missing spec:** no "not assessed" state exists for a rating, although `fit_result` already defines `not_assessed` for vacancy skills with no portfolio match.

### F-002 · Fit/gap screen reads fields the API never sends — DI · web ↔ api
**Evidence (code + live payload).** The API returns `expected_level` and no override flag (`engine.rb:58-66`; live `GET /portfolios/1/fitgap/1`). The table reads `c.required_level` and `c.is_override` — `web/src/components/fitgap/ComparisonTable.tsx:50,56` — so **Required is always blank** and the "✏ = human override applied" legend (`:76`) never matches a row. The page renders `culture_narrative || overall_narrative` under the culture heading — `web/src/pages/fitgap/FitGapReportPage.tsx:173` — so the **hiring recommendation is never shown** when Gemini succeeds. The PDF reads the correct fields, so **screen and PDF disagree.**

### F-003 · Cross-tenant access to candidate evaluations — DI · api
`Portfolio.find(params[:id])` with no tenant scope at `app/controllers/api/v1/portfolios_controller.rb:82,104,130,156`; overrides via `PortfolioSkill.joins(:portfolio).find` in `portfolio_skills_controller.rb:51`. Only `Assessment`, `Session` and `Vacancy` include `TenantScoped`; ids are sequential bigints. **Impact:** read, export, regenerate or override another tenant's candidates.

### F-004 · Tenant resolved from client-controlled input — DI · api
`TenantResolverMiddleware` takes the tenant from the JWT `scheme` **decoded without verification**, else the `X-Tenant-Scheme` header, else the Referer host — `app/middlewares/tenant_resolver_middleware.rb:33-61`. Auth accepts any `Authorization` prefix (`app/auth/authorize_api_request.rb:66`), and nothing compares the verified token's scheme with the resolved tenant. Login picks the scheme from `X-Tenant-Scheme` or the first organization row — `app/controllers/api/v1/authentication_controller.rb:24-28`. **Escalated:** fixing this means redesigning tenant resolution for a database shared with rakamin-api (see Constraint Signal).

### F-030 · The API cannot boot in production — DI · infra
**Evidence (reproduced on `main`).**
- `RAILS_ENV=production rails runner` → `NoMethodError: undefined method 'active_job'`. `config/environments/production.rb:34` configures `config.active_job.queue_adapter`, but `config/application.rb` never loads the Active Job railtie, and nothing uses Active Job (workers are plain `Sidekiq::Worker`).
- With that removed, `rails zeitwerk:check` → `NameError: uninitialized constant AudioWebsocketMiddleware`. The file `app/channels/audio_websocket_middleware.rb` defines `AudioWebSocketMiddleware`; lazy loading in development and test never notices, but production eager-loads.

**Why it went unseen:** development and test never eager-load, and there was no CI. **Fix:** remove the dead Active Job line and map the two file names in `config/initializers/zeitwerk.rb`. **Verified:** a production-mode boot succeeds with `eager_load=true`, `zeitwerk:check` reports "All is good!", and the suite passes with `CI=1`. *Logged here because it was found while setting up CI, after the gap analysis; it is the one fix outside the planned slice.*

## P1

### F-005 · Recommendation ignores confidence and completeness — MS · api → web
**Evidence (live, session 1).** Session ended by the candidate after 199 s (`end_reason: manual_candidate`), 5 candidate turns. Fit/gap: React expected 3, candidate 1, `gap`, `confidence: low`. Overall narrative: *"we do not recommend proceeding with this candidate for a senior role."* Culture narrative: *"soft skills were not explicitly evaluated… they may struggle to establish credibility."* Nothing defines when the evidence is too thin to recommend; confidence is passed into the comparison but never used by the narrative prompt or the result (`engine.rb:93-147`).

### F-006 · Sessions end as `all_covered` with nothing covered — DI · api
**Evidence (live, session 2).** At 8 min 24 s (10-minute limit, before any wrap-up signal) the AI said *"You'll hear back from the team soon."* Log: `[AudioWS] AI closed without system signal — forcing coverage_pending`; 15 s later the session ended via `audio_complete` with `reason=all_covered` while **all three skills were `not_yet`**. Cause: closing-phrase fallback — `app/channels/audio_websocket_middleware.rb:250-263, 708-716`; `audio_complete` does no coverage re-check — `app/controllers/api/v1/sessions_controller.rb:118-129`.

### F-007 · Network check blocks working connections — DI · web
**Evidence (live).** Candidate check showed upload **"1.77 Mbps — Failed"** against a 4 Mbps minimum. `web/src/utils/internetSpeedTest.ts` computes `uploadSizeMB / seconds` (**megabytes**/s) and compares it to `minUploadMbps` (**megabits**/s) — an 8× under-report (~14 Mbps real). Upload is timed against `httpbin.org` (US), so round-trip latency counts as upload time. No "continue anyway" path (`web/src/components/HardwareCheck.tsx`). The test also sends the candidate's IP to five third-party hosts without notice.

### F-008 · Gemini failures are silent and never retried — DI · api
**Evidence (live, session 2).** 14 coverage jobs failed — **13 × HTTP 503**, 1 timeout, 1 × 429 — and **0 retry log lines**. The client configures `retry_statuses: [429, 500, 502, 503], max: 3` (`app/clients/gemini/http_client.rb:57-68`), but faraday-retry 2.4.0 only retries `delete/get/head/options/put` by default, and every Gemini call is a POST. The coverage worker has `retry: 0` and rescues all errors (`app/workers/coverage_analyzer_worker.rb:6,32`). Result: coverage stayed `not_yet / probe 0` for the whole interview, so the assessor monitor and the interviewer's skill map were empty. Also observed: the free tier caps at 20 requests/model/day, and one interview makes ~20 coverage calls.

### F-009 · Concurrent duplicate portfolio generation — DI · api + web
**Evidence (live, session 2).** Two Retry clicks 18 s apart started **two generator jobs** for the same portfolio (Sidekiq jids `fc2376…`, `bc2c59…`). The generator marks the portfolio `failed` on every attempt and re-raises (`generator.rb:34-36`), so the UI offers Retry while Sidekiq retries are still queued; `regenerate` only checks `failed?` (`portfolios_controller.rb:35`). `save_skills` runs `destroy_all` then `create!` with no transaction (`generator.rb:154-178`), and `PortfolioSkill` destroys its override (`app/models/portfolio_skill.rb:7`) — so a late job can **delete assessor overrides**.

### F-010 · Every failure looks like success to the candidate — DI · web
The "Interview Complete — The interview has been recorded" screen (`web/src/pages/interview/InterviewPage.tsx:230-236`) is reached from: a failed first fetch (`:51`), any non-recoverable socket error including `auth_failed` (`web/src/hooks/useAudioWebSocket.ts:103-106`), and three failed reconnects (`:130`). The server's error message is discarded.

### F-011 · PDF export crashes when an override exists — DI · api
`"(AI: … → Override: …)"` at `app/services/exports/pdf_generator.rb:85`. Prawn's built-in fonts are Windows-1252 and cannot encode `→`, raising `Prawn::Errors::IncompatibleStringEncoding`. Same for any non-Latin-1 text in evidence or summaries. Also `stroke_color 'CCCCCC'` is never reset (`:112`). *Verified in code; live reproduction pending regenerated data.*

### F-012 · States that never resolve — MS + DI · api + web
- Portfolio stuck in `generating` if the worker dies mid-call; `regenerate` refuses anything not `failed` (`portfolios_controller.rb:13,35`).
- Fit/gap has **no status column**: a dead job leaves the page polling forever (`FitGapReportPage.tsx`).
- A vacancy with zero skills always fails: `validates :skill_comparisons, presence: true` rejects `[]` (`app/models/fit_gap_report.rb:9`).
- Portfolio requested before the session ends returns `202 generating` forever (`portfolios_controller.rb:13`).

### F-013 · Model output parsed unsafely — DI · api
`"L3"` → `to_i` → 0 → clamp → **1**; `3.7` → 3 (`generator.rb:161`). Confidence `"High"` fails the enum validation mid-save (`app/models/portfolio_skill.rb:11`). Invented skills are saved, omitted skills silently disappear, and `skill_id` is taken from model output (`generator.rb:158`). Confidence is also chosen by the model from overlapping rules (`generator.rb:97-100`).

### F-014 · No consent, retention or deletion — MS · web + api
No consent, privacy or recording notice anywhere in `web/src`; the only mention is *after* the interview. No endpoint deletes a session, transcript or portfolio; no retention job. Deletion is also blocked at the model layer: `Portfolio` declares no `has_many :fit_gap_reports, dependent: :destroy`, so destroying a session whose portfolio has a fit/gap report raises `PG::ForeignKeyViolation` (found while building the demo seed). Transfer of voice and transcripts to Google Gemini is undisclosed. See `01-context.md §5`.

### F-015 · Personal data in logs — DI · api
`app/clients/gemini/live_client.rb:285-297` logs every transcript fragment at INFO (production level). No `filter_parameter_logging` exists under `config/`, so login passwords and `candidate_name` appear in request logs. `generation_error` exposes raw exception text to the client.

## P2

- **F-016 · `LevelRadio` duplicate ids.** `id={\`level-${level}\`}` at `web/src/components/assessment/LevelRadio.tsx:23`; with several cards or override panels on a page, a label click targets the first matching id.
- **F-017 · Skill removal never persisted.** `remove(index)` drops the row without `_destroy` (`web/src/pages/assessments/AssessmentEditPage.tsx:146`, `web/src/pages/vacancies/VacancyEditPage.tsx:78`); models use `allow_destroy: true`.
- **F-018 · Coverage state machine.** Partial skills with probe ≥ 4 are promoted to `covered` without checking the stated context-window condition (`app/workers/coverage_analyzer_worker.rb:91-100`); concurrent per-turn jobs can regress state; jobs for the final turns are dropped once the session ends (`:11`).
- **F-019 · Login errors never shown.** The axios interceptor reloads to `/login` on any 401/403 (`web/src/services/api.ts:30-33`), including a wrong password.
- **F-020 · Invite tokens.** No expiry; `audio_complete` lets the token holder end an active session as `all_covered` (`sessions_controller.rb:118-129`).
- **F-021 · Hardcoded control token.** `SYSTEM_SIGNAL_TOKEN = 'SYS-TC-7x9k'` (`app/channels/audio_websocket_middleware.rb:16`) is also embedded in the system prompt.
- **F-022 · Rate limiting and input bounds.** Rack::Attack covers only login and candidate endpoints; nothing limits WebSocket upgrades or Gemini-triggering endpoints; no length validations on free-text fields that feed prompts.
- **F-023 · Shared database names.** `config/database.yml` hardcoded `rakamin_development` / `rakamin_test`; `db:test:prepare` purges the test DB. **Fixed in setup:** renamed to `ai_interview_*`.
- **F-024 · Retired model names.** `application.yml.sample` lists `gemini-2.0-*` models that no longer exist; `gemini-2.5-*` is closed to new keys; Pro models are only served on `v1beta` while `Gemini::HttpClient::BASE_URL` is `v1`.

## P3

- **F-025** No login user is seeded; `SignupPage.tsx` calls a `/signup` route that doesn't exist.
- **F-026** `api/bin/{rails,rake,bundle}` are committed as mode `100644`.
- **F-027** `web/.env.example` and `web/src/services/api.ts` default to port 3000; the API serves 3001; `APP_BASE_URL` in the sample points invite links at the API.
- **F-028** `assessments#destroy` returns "Assessment deleted" when `restrict_with_error` blocked it (`app/controllers/api/v1/assessments_controller.rb:51-53`).
- **F-029** Assessment, vacancy and vacancy-picker lists read only page 1 although the API returns pagination meta.
- **F-031** Fit/gap reports are not refreshed when a vacancy's skills change. Session 1's report kept comparing only React after REST and Cloud were added to the vacancy, until it was regenerated by hand.

---

## Missing specification vs defective implementation

**Never defined (MS):** a "not assessed" rating (F-001); when evidence is too thin to recommend (F-005); generation status for fit/gap and a recovery path for stuck generation (F-012); consent, retention, erasure and transfer notice (F-014); rate and size limits (F-022); a seeded login path (F-025).

**Defined but broken (DI):** the L1 clamp and `parseLevel` fallback (F-001, F-013); the API contract on the report screen (F-002); tenant isolation (F-003, F-004); end-of-interview rules (F-006, F-020); network thresholds (F-007); retry configuration (F-008); regenerate guard and transactional save (F-009); candidate end states (F-010); PDF encoding (F-011); form ids and nested destroy (F-016, F-017); coverage promotion (F-018).

The core product failure (F-001 + F-005, surfaced by F-002) crosses **both services and the seam between them**: data computation in the API, and presentation in the web app.

---

## Constraint Signal — what I would escalate to a Tech Lead before writing code

1. **Shared database with rakamin-api.** App tables live in an `ai_interview` schema inside rakamin-api's database; `organizations` is owned by the other service, yet a migration in this repo creates it; `schema_migrations` sits in `public`. Any migration or test-harness work risks the other service. *Decision needed:* who owns migrations on the shared database, and should this service get its own database?
2. **Tenant isolation is broken at the middleware, not per endpoint** (F-003, F-004). Patching controllers one by one won't close it. *Decision needed:* the tenant must come from a verified claim and be enforced on every model — a cross-cutting change that needs an owner and a security review.
3. **The product spec lives only in the GitHub wiki, and the code disagrees with it** (spec IDs N2–N14 in comments). I could not confirm intended behavior for "not assessed", confidence, or recommendations. *Assumption made:* a rating must be backed by evidence; where the spec is silent, the system must say so rather than guess.
4. **No tests, no CI, and an LLM in the critical path.** Found later, and the clearest proof: the codebase as handed over **cannot boot in production** (F-030), and nothing would have caught it. Every rating depends on free-form model output. Without a harness that stubs Gemini, no change to scoring can be verified. This PR builds that harness first.
5. **External AI capacity is a production dependency.** The free tier allows 20 requests/model/day; one interview makes ~20 coverage calls; we observed 13 × 503 in one session with retries silently disabled (F-008). *Decision needed:* paid tier and quota monitoring before any client rollout.
6. **Candidate data obligations under UU PDP** (F-014, F-015) need legal and product sign-off — consent copy, retention period, and the cross-border transfer disclosure are not engineering decisions alone.
7. **Brief ambiguity.** The deadline in the brief ("Wednesday 19 August") had already passed when the brief was received. *Assumption made:* a 1–2 day effort window, documented in the report.
