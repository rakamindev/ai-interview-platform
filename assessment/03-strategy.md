# 03 · Revamp Strategy, Acceptance Criteria & Trade-offs

> Brief Step 4. Builds on `01-context.md` (why it matters) and `02-findings.md` (what is broken).

## 1. The problem this revamp solves

**The product turns absence of evidence into evidence of absence** (F-001, F-005). When an interview yields no signal about a skill, the system still records L1, reports a *gap*, and writes a confident *"do not recommend"*. The report screen then hides the one field that would let a recruiter notice (F-002).

**Goal:** every number a hiring team sees is backed by evidence, every missing measurement is labeled as missing, and no recommendation is issued on evidence too thin to support it. The screen, the API and the PDF all say the same thing.

**Claimed depth: frontend-heavy.** The backend module is deliberately small but real: a migration, scoring and fit/gap rules, an API contract, and specs. The frontend module carries the depth: report screens redesigned around evidence, every interaction state, responsive layout, accessibility, and component tests.

## 2. Scope

**In scope** (one theme, both services):

| Finding | What ships |
|---|---|
| F-001 Unassessed → L1 | Nullable level end to end; prompt allows "not assessed"; parser never invents a level. |
| F-005 Recommendation ignores evidence quality | A deterministic evidence-sufficiency gate before any recommendation is written. |
| F-002 Report screen ↔ API mismatch | A corrected and typed API contract; fit/gap screen rebuilt. |
| F-013 Unsafe model parsing | `LevelParser`, confidence normalization, skill reconciliation, transactional save. |
| F-009 Duplicate generation | Atomic regenerate guard; failed only after retries are exhausted. |
| F-012 States that never resolve | Empty-vacancy report; not-ready state; client timeout with retry. |
| F-011 PDF crash | Encoding-safe export that shows "Not assessed" and the evidence status. |
| F-003 Cross-tenant access | Tenant-scoped lookups **on the endpoints this PR touches**. |
| F-016 `LevelRadio` ids | Unique ids, since the override flow depends on them. |
| F-008 Silent failures (partial) | Generation failures surfaced in the UI with a reason. Retry config and coverage worker escalated. |

**Escalated, not changed:** F-004, F-006, F-007, F-010, F-014, F-015, F-017–F-029. Each has a proposed fix in `02-findings.md`.

## 3. Options considered

| | **A · Frontend-only patch** | **B · Explicit evidence model, end to end (chosen)** | **C · Re-score from transcript deterministically** |
|---|---|---|---|
| **What** | Fix field names; render "L1 + low confidence" as "unclear". | Nullable level and an explicit `not assessed`; a deterministic sufficiency gate before recommendations; corrected API contract; report UI rebuilt around evidence. | Replace the model's levels with a pipeline that grades each turn against the anchors and aggregates scores. |
| **Product impact** | The table becomes readable, but it is still lying: a measured L1 and an unmeasured "L1" look identical. | Recruiters can tell a real gap from a missing measurement. Candidates are never scored on unasked questions, and no verdict is issued on thin evidence. | Most accurate levels, but it doesn't address the recommendation or presentation problems on its own. |
| **Cost** | ~2 h | ~7–8 h | Days, plus model-evaluation work. |
| **Forecloses** | Nothing, but it bakes the guess into the UI. | Nothing. It is the data foundation C would need anyway. | Time for everything else. |
| **Maintainability** | Heuristics spread through components. | One rule per layer, each unit-tested; a reversible migration. | New ML surface with prompt drift and evaluation burden. |
| **Failure modes** | Mislabels real weak answers as "unclear" because it guesses. | The model may still return a level with weak evidence. Mitigations: evidence-required rule, low-confidence gate, assessor override. | Per-turn grading latency and cost; quota exhaustion (already observed at 20/day). |
| **Walk-back** | Trivial | Rollback restores old behavior (lossy for NULLs, documented). | Hard |

**Why B fits *this* codebase and *this* deadline:** the defect lives at five seams (prompt, parser, schema, rules, screen). Fixing one seam leaves the lie intact at the next, and B is the smallest change that makes all five agree. The existing code already gives a foothold: `fit_result` defines `not_assessed`; the fit/gap engine and portfolio generator accept an injected Gemini client, so they are testable without network calls; and assessor overrides already exist as the human-in-the-loop path.

## 4. Design decisions and rejected alternatives

**D1 · How "not assessed" is stored.** `portfolio_skills.ai_level` and `ai_confidence` become nullable. A CHECK constraint keeps them consistent: both NULL, or both set and in range. The API exposes an explicit `assessed` boolean so clients never infer meaning from `null`.
*Rejected:* a sentinel `0` (looks like a level, sorts and averages wrong); a separate status column (two sources of truth for one fact).

**D2 · What counts as evidence: the rule changed after the live data.** The original plan forced "not assessed" whenever coverage said `not_yet`. **Session 2 disproved it.** Gemini returned 503s for 13 of 14 coverage calls, so every skill stayed `not_yet` even though the candidate answered React and REST at length. A coverage-driven rule would have discarded real evidence because of an outage.
*Chosen:* a level is kept only when the model returns a parseable level **and** at least one candidate evidence quote. Coverage state goes into the prompt as a hint, never as a hard override.
*Rejected for now:* verifying quotes as verbatim substrings of the transcript. Models lightly paraphrase quotes and speech-to-text fragments words, so exact matching would produce false negatives. Proposed as a follow-up with fuzzy matching.

**D3 · The recommendation gate (AC13).** The fit/gap engine computes `recommendation_status` deterministically, **before** any model call. It returns `insufficient_evidence` if any of these hold:
1. a vacancy skill is `not_assessed` after overrides;
2. a compared skill has `low` confidence and no assessor override;
3. the session ended by `manual_candidate` or `error`.

When insufficient, **no hiring recommendation and no culture narrative are generated**. The report stores the machine-readable reasons, and the UI explains what is missing and how to resolve it: override the skill, or re-interview. An assessor override counts as human assessment and clears reasons 1 and 2 for that skill.
*Rejected:* asking the model whether the evidence is sufficient (non-deterministic and untestable, and the same model wrote "do not recommend" from a 3-minute interview); a numeric fit-score threshold (false precision on 1–5 ordinal levels).
*Side benefit:* gated reports make no Gemini call, which matters at 20 requests per day.

**D4 · Confidence.** Normalized (`"High"` → `high`; unknown → `low`; NULL when not assessed) and kept model-assigned with the existing rules.
*Rejected:* deriving confidence from coverage. The same unreliability as D2 would mark well-evidenced answers as low.

**D5 · Regeneration safety (F-009).** A portfolio is marked `failed` only when Sidekiq retries are exhausted; between retries it stays `generating`, with the last error visible. `regenerate` flips `failed → pending` with a single conditional `UPDATE … WHERE generation_status = 'failed'`, so a double-click enqueues once. Skills are saved in one transaction, so a failed save leaves the previous skills untouched.

**D6 · Fit/gap status (F-012).** No new status column. The report endpoint distinguishes "not generated yet" from "portfolio not ready", and the client stops polling after 3 minutes with a Retry action.
*Trade-off:* a dead job is detected by timeout rather than recorded. A proper job-status column is a follow-up.

**D7 · Tenant scoping (F-003).** Portfolios are looked up through the tenant-scoped `Session` on every endpoint this PR touches; the export, fit/gap and override endpoints return 404 across tenants. The middleware design (F-004) is escalated, not patched.

**D8 · PDF encoding (F-011).** Characters outside the PDF font's Windows-1252 range are transliterated (`→` becomes `->`), and anything left unmappable becomes `?`, so evidence text can never crash an export.
*Rejected for now:* bundling a Unicode TTF (~700 KB in the repo for an edge case; Bahasa Indonesia is fully covered by Windows-1252). Logged as a follow-up for non-Latin scripts and emoji.

## 5. Acceptance criteria

Written before implementation; each maps to automated tests (§7).

**Backend**

- **AC1 · Evidence or nothing.** A skill is stored with `ai_level = NULL, ai_confidence = NULL` when the model returns `null`, `"N/A"`, `"not_assessed"`, an unparseable or out-of-range level, **or no candidate evidence quote**. It is never stored as L1 by default.
- **AC2 · Level parsing.** `3`, `"3"`, `"L3"`, `"l3"`, `" L3 "`, `3.0` → 3. Non-integers such as `3.7`, out-of-range `0`/`6`, and garbage → not assessed. Rejections are logged without personal data.
- **AC3 · Confidence.** Case-insensitive; unknown values → `low`; not assessed → NULL.
- **AC4 · Reconciliation.** Every configured skill appears exactly once. One the model omitted is stored as not assessed. `skill_id` comes from the assessment, never from the model. Duplicates from the model keep the first entry. Discovered skills are kept only when assessed.
- **AC5 · Atomic save.** Skills are replaced inside one transaction. On any error the previous skills and their overrides are untouched. Malformed JSON, a string or array response, or a Gemini error → `failed` once retries are exhausted, with a readable reason.
- **AC6 · Honest comparison.** A not-assessed skill without an override → `result: not_assessed, candidate_level: nil, delta: nil`. An override applies even when the AI said not assessed. Each comparison carries `expected_level`, `candidate_level`, `ai_level`, `is_override`, `confidence`.
- **AC7 · Empty vacancy.** A vacancy with zero skills produces a report with `skill_comparisons: []` and `recommendation_status: insufficient_evidence` (reason: `no_vacancy_skills`), not a dead job.
- **AC8 · API contract.** Portfolio skills expose `ai_level` (int or null), `assessed`, `effective_level`, `confidence`, and `override` (nested or null). A session that hasn't ended returns `status: not_ready`, not `generating`.
- **AC9 · Tenant isolation.** Portfolio show/regenerate/export, fit/gap create/show/regenerate and override return 404 for another tenant's records, and 401 without a token.
- **AC10 · PDF.** Export succeeds with overrides and non-Latin-1 text, shows "Not assessed", and shows the evidence status instead of a recommendation when gated.
- **AC13 · Recommendation gate.** `recommendation_status` is `insufficient_evidence` exactly when a D3 rule holds, and the stored reasons say which rule and which skills. When gated, `overall_narrative` and `culture_narrative` are NULL and no Gemini call is made. Overriding the blocking skills and regenerating clears the gate.
- **AC14 · Regeneration safety.** Concurrent regenerate requests enqueue one job. The status stays `generating` while retries remain and becomes `failed` only after the last attempt.

**Frontend**

- **AC11 · Every state handled.** Portfolio and Fit/Gap screens handle: loading, not ready, generating, failed (with reason) and retry, client timeout, empty vacancy, all skills not assessed, mixed, insufficient evidence, long text (clamped with "Show more"), 390 px mobile, keyboard-only use and screen readers.
- **AC12 · "Not assessed" is unmistakable.** Visually distinct from L1: neutral, dashed, no level number, with a plain-language reason ("Not covered in the interview — no evidence"). Summary reads "N of M skills assessed". Low confidence uses neutral styling, not error red. The report shows the evidence status *above* any recommendation, and when gated, lists what is missing with a direct "Rate manually" action on each blocking skill.
- **AC15 · Contract fidelity.** The Required column shows `expected_level`; the override marker appears on overridden rows; the overall recommendation and culture narrative render in separate sections; screen and PDF show the same values for the same report.
- **AC16 · Override reliability.** Clicking a level label changes only its own skill (unique ids); saving an override shows success or error; Retry is disabled while a request is in flight.

## 6. Edge cases (input → expected behavior)

| Input | Expected |
|---|---|
| Model returns `"level": "L3"` | Stored as 3 (AC2). |
| Model returns `"level": null`, `"N/A"`, `0`, `6`, `3.7` | Not assessed (AC1, AC2). |
| Model returns a level with `"evidence": []` | Not assessed (AC1). |
| Model omits a configured skill | Stored as not assessed (AC4). |
| Model invents a skill name not in the assessment | Treated as discovered; kept only if assessed (AC4). |
| Model returns prose, an array, or invalid JSON | `failed` after retries with a readable reason; previous skills kept (AC5). |
| Gemini 429/503/timeout | Retried by Sidekiq; UI shows "Generating" with "retrying after a temporary error"; `failed` only at the end (AC14). |
| Retry clicked twice | One job (AC14). |
| Candidate ends the interview at 3 minutes | Report gated: `insufficient_evidence`, reason `ended_early` (AC13). |
| All skills not assessed | Portfolio shows "0 of N assessed" and the rate-manually path; fit/gap gated (AC11–AC13). |
| AI not assessed, assessor overrides to L2 | Comparison uses L2 with `is_override: true`; the gate clears for that skill (AC6, AC13). |
| Vacancy with no skills | Report renders the empty state with guidance (AC7, AC11). |
| Summary or evidence of 2,000+ characters | Clamped to 4 lines with "Show more"; no layout overflow at 390 px (AC11). |
| Evidence containing `→`, emoji, or curly quotes | PDF exports; unmappable characters replaced (AC10). |
| Another tenant's portfolio id | 404 (AC9). |

## 7. Test strategy

- **API (RSpec):** unit specs for `LevelParser` and the sufficiency rules; service specs for the generator and fit/gap engine with a fake Gemini client (every row of §6); request specs for the contract, tenant isolation (cross-tenant 404, missing token 401) and regenerate idempotency; a PDF spec with an override and non-Latin-1 text.
- **Web (Vitest + Testing Library):** components (level badge, comparison table, skill card, `LevelRadio` ids) and both pages, with the API module mocked across every AC11 state.
- **Proof the tests are real:** a seeded-fault branch reintroduces `to_i.clamp(1, 5)` and the `required_level` field, shows the failures, then reverts with history visible (`04-verification.md`).
- **End to end:** a deterministic demo seed for every UI state (no Gemini needed), plus one live interview once quota allows.

## 8. Migration safety

- `up` only **relaxes** constraints (drops NOT NULL, widens a CHECK) and adds two nullable columns to `fit_gap_reports`. It is safe on existing rows: no rewrite, no backfill.
- `down` restores the constraints after backfilling NULLs to the old values (`ai_level` 1, confidence `low`), so rollback works and is **documented as lossy**: it re-creates the original behavior for unassessed rows.
- Raw SQL with `SET search_path TO ai_interview`, matching existing migrations; nothing touches `public` (the shared rakamin-api tables).

## 9. Assumptions

1. **A rating must be backed by evidence.** The spec wiki was not available; where it is silent, the system says "not assessed" rather than guess.
2. **The three insufficiency rules in D3 are a product default,** not a final policy. Thresholds would be tuned with assessors; the rules are isolated in one module so they can change without touching the UI.
3. **An assessor override is a human assessment** and may stand in for missing AI evidence.
4. **Deadline:** the brief's date had passed on receipt; the work assumes a 1–2 day window.
5. **Gemini free tier** (20 requests/model/day) limits live verification; the deterministic seed and fake client carry the test burden.

## 10. Frontend design decisions (claimed depth)

The brief asks for "using or extending the design system", so the Rakamin teal/yellow tokens and the shadcn components stay. The extension is an **evidence language**:

| Token | Meaning |
|---|---|
| `evidence` (teal, the existing primary) | a level backed by what the candidate said |
| `required` (slate) | the vacancy's required level |
| `shortfall` (orange) | a measured gap. Kept apart from red, which stays reserved for errors |
| `attention` (amber) | missing or weak evidence, legacy reports |
| `unassessed` (slate, always dashed) | no evidence |

- **One recurring element, the `LevelTrack`.** Five rungs, with the candidate's level filled and the required level underlined. Gap, match and exceed read at a glance without emoji. With no evidence every rung is dashed, so "not assessed" can never be mistaken for L1. It appears on skill cards, table rows and mobile cards.
- **Level badges use one teal ramp, light to dark.** The old palette gave L1 the same grey as an empty state.
- **Withheld recommendations come first.** When the gate withholds one, the page opens with what is missing and a direct action for each item. The AI narrative is labelled as AI-written and shown only when the evidence supports it.
- **Every state is designed.** Loading, not ready, generating (with the retried error), failed with reason, timeout, empty vacancy, nothing assessed, long text (clamped), 390 px mobile, keyboard focus, `aria-live` status and labelled icon buttons.
- **Copy.** Plain verbs and sentence case. Errors say what happened and what to do; there are no emoji status icons and no uppercase labels.

## 11. Pull request shape

One comprehensive PR (brief Option A), because this is a single theme across both services and splitting it would ship an API contract without its consumer. Commits are layered so the PR reads bottom-up: harness → migration → parser and generator → fit/gap gate → API contract and tenant scope → PDF → web contract → components → pages → tests → demo seed.
