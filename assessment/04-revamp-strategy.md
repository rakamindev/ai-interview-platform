# Step 4: Revamp strategy, acceptance criteria and trade-offs

Written before any product code changed. Findings referenced (F1, N1, ...) are in
`03-findings.md`; every one of them was reproduced at runtime first.

## 1. The slice

**"Never report a rating the interview did not earn."**

Goal: what reaches an assessor, a hiring manager and the PDF must be (a) about the right
company's candidate, (b) backed by something the candidate actually said, and (c) honest about
how much evidence it rests on. Today an unmeasured skill becomes "L1", then "Gap", then a
sentence in the hiring recommendation (F2), the assessor cannot see the requirement or the
confidence (F3, F4), and their correction breaks the export (F10).

Why this slice and not another:
- It is the path from data to decision. A wrong result here "changes a real person's year"; a
  wrong result in, say, the assessment builder does not reach a candidate.
- It covers both services through the seam where the defects sit: generator and fit/gap engine
  (backend), portfolio and fit/gap screens (frontend), and the JSON contract between them.
- The P0s in the same files (F1 tenant isolation) and the cheap data-protection fix (N1) come
  along, because shipping a "trustworthy report" that another tenant can read would be hollow.

What it deliberately does not try to fix is listed in section 6.

## 2. Users and the behaviour they need

| Who | What they are trying to do on these screens | What "correct" means for them |
|---|---|---|
| Assessor / recruiter | Review the AI's ratings, correct what is wrong, decide whether to advance the candidate | Sees which ratings are solid, which are thin, and which were never measured; can correct and still export |
| Hiring manager | Read a fit/gap report or PDF someone sent them | Requirement vs candidate on every row; no verdict on things nobody measured |
| Candidate (never chose this) | Be judged on what they said | A dropped connection or an unasked topic never becomes a weakness on their record |

## 3. Acceptance criteria (written before code)

Each criterion names the test layer that proves it. "Spec" = RSpec, "Vitest" = component test.

### AC1. Unmeasured skills are "Not assessed", everywhere
| # | Given | Then | Proved by |
|---|---|---|---|
| 1.1 | Coverage state `not_yet` (any probe count) | Skill stored with `assessment_status = not_assessed`, `ai_level = NULL`, `ai_confidence = NULL`, whatever the model returned | Spec (generator) |
| 1.2 | Session has zero candidate turns | No model call at all; every coverage-map skill stored `not_assessed`; portfolio `complete` | Spec (generator, fake client asserts not called) |
| 1.3 | A `not_assessed` skill vs a vacancy requirement | Fit/gap result `not_assessed` (never `gap`); counted separately in the summary | Spec (engine), Vitest (table) |
| 1.4 | Narrative prompt | Lists not-assessed skills as "unknown, not weak"; fallback text includes the not-assessed count | Spec (engine prompt) |
| 1.5 | Portfolio UI, fit/gap UI, PDF, JSON | Shows "Not assessed: not discussed in the interview" instead of a level badge | Vitest, Spec (PDF text, JSON keys) |

### AC2. Bad model output is contained per skill
| # | Given (model output for one skill) | Then | Proved by |
|---|---|---|---|
| 2.1 | `level` is `3`, `"3"`, `"L3"`, `3.0` | Parsed to 3 | Spec (normalizer) |
| 2.2 | `level` is missing, `null`, `0`, `7`, `"three"`, an array | `assessment_status = needs_review`, `ai_level = NULL`, reason stored (not L1) | Spec (normalizer) |
| 2.3 | `evidence` not an array, has non-strings or blanks, more than 3, a quote over 500 chars | Coerced to at most 3 non-blank strings, each truncated to 500 chars | Spec (normalizer) |
| 2.4 | Blank `competency_summary` with a valid level | Level kept; summary empty; UI says "No summary provided" | Spec, Vitest |
| 2.5 | `skill_id` in another case (`sk-eng-001`), or only the label matches | Matched to the coverage map case-insensitively by id, then by label (N4) | Spec |
| 2.6 | Model omits a skill that has evidence in coverage | `needs_review` with reason "model returned no rating" | Spec |
| 2.7 | Model invents a skill that is not in the coverage map, or repeats one | Ignored (first occurrence kept); count logged, no candidate text logged | Spec |
| 2.8 | Whole response is not JSON / not an object | Attempt fails as retryable; no rows written | Spec |
| 2.9 | Any failure while saving | Nothing is half-written: the previous skills stay as they were (single transaction) | Spec |

### AC3. Confidence follows the PRD rule, not the model
| # | Coverage | Confidence | Proved by |
|---|---|---|---|
| 3.1 | `covered` and `probe_count >= 3` | high | Spec (unit, table-driven) |
| 3.2 | `probe_count == 2` or `partial` | medium | Spec |
| 3.3 | `probe_count <= 1` or `initiated` | low | Spec |
| 3.4 | Model says `"High"` / `"certain"` / nothing | Ignored, never fails validation (the F5 crash) | Spec |

Note: the PRD rule overlaps (for example `covered` with 2 probes). Resolution order: low rule
first, then medium, then high, so the weakest matching label wins. Written down as an assumption.

### AC4. Fit/gap shows the whole picture, honestly
| # | Given | Then | Proved by |
|---|---|---|---|
| 4.1 | Any row | Required level, candidate level, confidence and result are all rendered | Vitest using the shared contract example, Spec (serializer) |
| 4.2 | Low-confidence rating | Result kept but flagged `provisional`; UI shows "Provisional · 1 question" and the summary does not count it as a firm gap | Spec, Vitest |
| 4.3 | Skill has an assessor override | `overridden: true`, effective level is the override, original AI level shown on hover/line | Spec, Vitest |
| 4.4 | `needs_review` skill | Result `needs_review`, not a gap | Spec, Vitest |
| 4.5 | Reports stored before this change | Served with defaults for missing keys and a `stale` flag; UI offers "Regenerate with current rules" | Spec (serializer on legacy JSON) |
| 4.6 | Narratives | Both culture and overall narrative shown, labelled "AI-written draft, check before sharing"; generated from competency summaries plus vacancy expectations, as PRD-02 specifies | Spec (prompt), Vitest |
| 4.7 | Vacancy with zero skills | Empty state, not an empty table | Vitest |

### AC5. Tenant isolation on every portfolio endpoint
| # | Given | Then | Proved by |
|---|---|---|---|
| 5.1 | Token for tenant A, ids from tenant B | 404 on export (json, pdf), fitgap POST, fitgap GET, regenerate_fitgap, portfolio_skills override | Spec (request, one example per endpoint) |
| 5.2 | Same token, own ids | Unchanged behaviour | Spec |
| 5.3 | Background workers (no request tenant) | Still find their records | Spec |

### AC6. Regeneration and overrides never destroy human work
| # | Given | Then | Proved by |
|---|---|---|---|
| 6.1 | Portfolio regenerated, skill had an override | Skill row updated in place (keyed by skill), override kept | Spec |
| 6.2 | Regenerated skill becomes `not_assessed` but has an override | Override kept and shown; the assessor's level is the effective level | Spec |
| 6.3 | Override on a `not_assessed` skill | Allowed only with a note (the assessor must say what evidence they used) | Spec, Vitest |
| 6.4 | Override input | `override_level` integer 1 to 5; notes at most 2,000 chars; errors returned as 422 with a message | Spec |
| 6.5 | Override saved | Card shows level change, note, and time; copy "Overridden by you" | Vitest |

### AC7. One job at a time
| # | Given | Then | Proved by |
|---|---|---|---|
| 7.1 | Fit/gap page open while generating | Exactly one `POST /fitgap`, then GET polling only | Vitest (fake timers, mocked API) |
| 7.2 | Two `POST /fitgap` for the same pair in quick succession (two tabs) | One job enqueued; second call returns 202 "already generating" | Spec |
| 7.3 | Portfolio generation is between Sidekiq retries | Status stays `generating` with "attempt N, last error: ..."; Retry is not offered; regenerate returns 409 | Spec (worker + controller), Vitest |
| 7.4 | Retries exhausted | `failed` with a readable reason (for example "AI model unavailable (404)"), Retry offered | Spec, Vitest |

### AC8. Stuck generation is recoverable (should-have)
| # | Given | Then | Proved by |
|---|---|---|---|
| 8.1 | `generating` or `pending` for longer than 20 minutes since the last attempt started | API reports `stale: true`; regenerate allowed; UI shows "This is taking longer than expected" with Retry | Spec, Vitest |

### AC9. Export works for real data and fails visibly
| # | Given | Then | Proved by |
|---|---|---|---|
| 9.1 | Portfolio with an override (`→`), Indonesian text, an em dash, an emoji, a non-Latin name, a 5,000-char summary | PDF export 200, valid PDF, text wraps | Spec |
| 9.2 | Export fails (422/500/network) | Button returns to idle and an inline error explains what happened | Vitest |
| 9.3 | Portfolio not `complete` | Export buttons not shown | Vitest |

### AC10. No sensitive data in logs (N1)
| # | Given | Then | Proved by |
|---|---|---|---|
| 10.1 | Login, session create, override requests | `password`, `token`, `candidate_name`, `assessor_notes`, `email` logged as `[FILTERED]` | Spec (filter config) |
| 10.2 | Generator and normalizer logs | Counts and ids only, never transcript, quotes or summaries | Review + spec on log output |

### AC11. UI states (portfolio and fit/gap screens)
Loading (skeleton), empty (no skills / no vacancy skills), not assessed, needs review, low
confidence, partial (some skills not assessed), generating with attempt info, stale, failed with
reason, fetch error with retry, long labels and quotes (wrap, no overflow), and 375 px width
with no horizontal page scroll (fit/gap rows become stacked cards). Checked in a real browser
at 375 px and 1280 px, with screenshots for the report.

## 4. Options and trade-offs

### 4.1 Representing "not assessed" (backend data model)

| | A. Explicit status column, nullable level | B. No row; derive from coverage at read time | C. Sentinel level (0) |
|---|---|---|---|
| What changes | Migration: add `assessment_status` (`assessed` default, `not_assessed`, `needs_review`) and `status_reason`; make `ai_level` and `ai_confidence` nullable | No migration; generator skips unassessed skills; engine, serializers, PDF and UI merge coverage maps in | Store 0, widen the check constraint |
| Product impact | Full: one record per skill, the portfolio is a complete account of the interview, `needs_review` is representable, overrides attach to any skill | Partial: `needs_review` has nowhere to live; every reader must remember the merge | Looks done, but every consumer that does `level - expected` treats 0 as a huge gap |
| Failure modes | Code that assumes `ai_level` is present crashes on NULL (find them with specs and a grep); down-migration with NULL rows | A forgotten reader silently drops skills from a report | Silent wrong math; bakes fake data into the schema |
| Existing rows | Default `assessed`, untouched; safe | Untouched | Untouched |
| Reversible | Down restores NOT NULL; refuses (raises with a message) if NULL rows exist rather than inventing levels | Trivially | Yes |
| Cost | ~0.5 day | ~0.5 day, but spread across 5 readers | Low |

**Choice: A.** It makes the honest state a first-class value that the database, the API contract
and the UI all carry. B forecloses `needs_review` and keeps the bug class alive in every new
reader. C is rejected outright: it is the current bug with a different number.

Existing portfolios already contain L1 ratings for unmeasured skills. A backfill (separate rake
task, not inside the migration, dry-run by default) marks a row `not_assessed` where its
session's coverage map says `not_yet`, keeping the old `ai_level` for audit. It is optional to
run and fully re-runnable.

### 4.2 Tenant isolation (backend)

| | A. Scope through the parent session | B. `tenant_id` on child tables + `TenantScoped` |
|---|---|---|
| What changes | A `Portfolio.in_current_tenant` scope (`joins(:session)`), used in the ~6 lookups in two controllers | Reversible migration adding `tenant_id` to 4 tables, backfill from sessions, `NOT NULL` after backfill, include the concern |
| Verified | Yes: under tenant A, `Portfolio.joins(:session).where(id: 3)` generates `sessions.tenant_id = 1` and finds nothing (Rails 7.0) | n/a |
| Defence in depth | One layer (the session's default scope) | Two layers; also protects future queries that forget the join |
| Failure modes | A new endpoint that uses `Portfolio.find` reopens the hole; mitigated by a request spec per endpoint and one shared lookup | Backfill on large tables, write paths that forget to set `tenant_id`, workers without tenant context |
| Cost | ~2 hours | ~1 day plus production backfill planning |

**Choice: A now, B proposed as a follow-up** to the Tech Lead. A closes the verified P0 today with
no data migration under deadline; the request specs pin the behaviour so B can land later
without changing it.

### 4.3 Fit/gap contract (the seam)

| | A. Rename API to `required_level` | B. Web reads `expected_level` | C. B + a serializer + a shared contract example used by both test suites |
|---|---|---|---|
| Stored reports | JSONB rows keep `expected_level`; needs read-time mapping anyway | Matches stored data | Serializer maps legacy rows and fills new keys |
| Drift protection | None | None | RSpec asserts the serializer output matches `contracts/fit_gap_report.example.json` key for key; Vitest renders the table from the same file |
| Cost | Low | Lowest | ~2 hours more |

**Choice: C.** `expected_level` is the domain name (`vacancy_skills.expected_level`), so the API
keeps it and the UI keeps the label "Required". The contract file is what turns "the Required
column was blank for every report ever generated" into a test failure.

### 4.4 Handling model output

| | A. Strict server-side normalizer per skill | B. Ask Gemini for a JSON schema response | A + B |
|---|---|---|---|
| Protects against | Any shape, any provider, any prompt change | Shape errors only, if the model and API version support it | Both |
| Cost / risk | Pure Ruby, unit-testable | Client hardcodes API `v1`; schema mode support differs per model (see N2) | Adds the risk of B |

**Choice: A.** The normalizer is the trust boundary no matter what the model promises. B is a good
follow-up once the model and API version are settled (constraint signal 2).

### 4.5 Duplicate jobs

| | A. Frontend only: POST once, then poll | B. A + Redis lock per (portfolio, vacancy) | C. `sidekiq-unique-jobs` gem |
|---|---|---|---|
| Covers | One tab | Any number of tabs and users | Any number |
| Failure modes | Two tabs still double-spend | Lock TTL must exceed the longest run; worker crash leaves the lock until TTL | New dependency and its own config to defend |
| Cost | 1 hour | 2 to 3 hours | Similar, plus dependency |

**Choice: B** (`SET key NX EX 300`, released in `ensure`). The UI change fixes what users see; the
lock fixes what the database and the bill see.

For portfolio retries (F6a), the generator stops marking `failed` on each attempt. The existing
`sidekiq_retries_exhausted` hook already marks `failed` at the end, so the fix is mostly removal.
New columns `generation_attempts` and `generation_started_at` (same migration as 4.1) let the UI
show progress and let AC8 detect a stuck run.

### 4.6 PDF export (F10)

| | A. Embed a UTF-8 TTF (Noto Sans, OFL licence) | B. Transliterate to Windows-1252 |
|---|---|---|
| Product impact | Names and quotes print as spoken, including non-Latin names | Arrows become `->`, but anything outside Latin-1 is lost or mangled, on a person's record |
| Failure modes | Missing glyphs (for example CJK) render as boxes, no crash; ~500 KB font in the repo | Silent data loss |
| Cost | ~2 hours | ~1 hour |

**Choice: A**, with a spec that exports the hostile text from AC9.1.

### 4.7 Frontend structure

Keep the existing pages and Radix/Tailwind components (`components/ui`). Add one small
`AssessmentStatusBadge` and a `useFitGapReport` hook so the polling rule (AC7.1) is testable
without rendering the page. Rejected: introducing a data-fetching library (React Query). It would
remove the polling code, but it is a new dependency for two screens under this deadline; noted
as a follow-up.

## 5. Plan and cut line

Order follows risk: tests first for each criterion, backend before frontend, P0 first.

| Day | Work | Criteria |
|---|---|---|
| Sat 24 | RSpec + factories + fake Gemini client; Vitest + RTL; CI workflow; tenant isolation; log filtering | AC5, AC10 |
| Sun 25 | Migration (status, nullable level, attempts); normalizer; confidence rule; transactional upsert; backfill task | AC1, AC2, AC3, AC6.1-6.2 |
| Mon 26 | Fit/gap engine + serializer + contract; locks and retry status; PDF font; override validation | AC4, AC6.3-6.4, AC7, AC9.1 |
| Tue 27 | Frontend states, mobile layout, override audit, export errors; seeded fault test; screenshots, video, PDF report | AC1.5, AC4 UI, AC6.5, AC7.1, AC9.2-9.3, AC11 |
| Wed 28 | Buffer, PR, submit by 18:00 | |

**Must ship:** AC1 to AC7, AC9, AC10, AC11. **Should ship:** AC8, the legacy-report `stale` flag
(4.5), the backfill task. If Monday ends late, AC8 and the backfill move to "follow-ups" in the
PR, not half-built.

## 6. Out of scope, on purpose

| Item | Why not now | What the report says instead |
|---|---|---|
| F9 consent, retention, deletion, candidate access | Missing specification with legal content; needs product and legal decisions | A proposal and the open questions (constraint signal 3) |
| N3 tenant from header for scheme-less tokens | Changing auth needs the rakamin-api token contract, and candidate flows rely on the header | Escalation (constraint signal 1) |
| `tenant_id` on child tables (4.2 B) | Data migration on production tables under deadline | Follow-up with a migration plan |
| Evidence grounding (checking quotes appear in the transcript) | Valuable, but paraphrased quotes would create false `needs_review`; needs tuning on real data | Follow-up idea |
| Live audio interview path | Not reproducible locally (S1), outside the slice | Stated as a limit |

## 7. Assumptions (no live Q&A available)

1. `not_yet` means no evidence was collected, whatever the model says.
2. `initiated` with one probe is a real but thin signal: rated, `low` confidence, `provisional` in fit/gap.
3. When PRD confidence rules overlap, the weaker label wins.
4. The assessor's override is the effective level for every downstream use, including when the AI side is `not_assessed`.
5. "Required" in the UI is the vacancy skill's `expected_level`.
6. Narratives are drafts for the assessor, not statements to the candidate or the hiring manager without review.
7. Locally, `gemini-2.5-flash` stands in for both models; production model choice is open (N2).
