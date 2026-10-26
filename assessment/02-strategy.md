# 02 — Revamp Strategy, Acceptance Criteria & Trade-offs

Scope of this revamp: the **fit/gap report**, end to end (engine → API contract → job lifecycle → screen). Findings addressed: F2, F3, F4, F5, F6, F7 from `01-findings.md`.
Out of this slice, shipped as their own PRs: **F1** tenant isolation (`fix/tenant-isolation`, needs a data migration — see C3) and **F11** pre-check internet gate.

## 1. Goal in one sentence

A recruiter opening a fit/gap report sees **what was required, what the candidate showed, how much of the role was actually assessed, who decided each level (AI or human), and whether the narrative came from the model** — and the screen never lies by omission, never spins forever, and never disagrees with the PDF.

## 2. Assumptions (no live Q&A — written down instead)

| # | Assumption |
|---|---|
| A1 | "Not assessed" means *no evidence*, not *zero ability*. It must never count as a gap or a match. |
| A2 | Coverage = assessed vacancy skills ÷ total vacancy skills. Discovered skills (not in the vacancy) do not affect coverage. |
| A3 | An assessor override is the decision of record; AI level stays visible for audit. |
| A4 | `low` AI confidence on a *non-overridden* skill weakens the result; it does not change the level. |
| A5 | The narrative is advisory. A failed model call must not block the report; it must be labelled. |
| A6 | Generation is asynchronous (Sidekiq). One report row per (portfolio, vacancy) — already enforced by a unique index. |
| A7 | Deadline: 26 Oct 13:00 WIB (the brief's 19 Aug date is treated as template text). |

## 3. Acceptance criteria (defined before code)

### Computation (`FitGap::Engine`)
| ID | Given | Then |
|---|---|---|
| AC1 | Vacancy skill with a matching portfolio skill | Comparison has `expected_level`, `candidate_level`, `result` (`match`/`gap`/`exceed`), `delta`. *(already true — baseline spec)* |
| AC2 | Skill has an assessor override | `candidate_level` = override level, `is_override: true`, `ai_level` kept for audit. |
| AC3 | Skill has no override | `is_override: false`. |
| AC4 | Vacancy skill absent from portfolio | `result: not_assessed`, `candidate_level: null`, `delta: null`. Never counted as match/gap/exceed. |
| AC5 | AI confidence is `low` and no override | `low_confidence: true` on that comparison. Overridden skills are never `low_confidence`. |
| AC6 | Any report | `summary` = `{ total, assessed, not_assessed, coverage_pct, match, gap, exceed, low_confidence }`, integers, `coverage_pct` rounded 0–100. Vacancy with 0 skills → `total: 0, coverage_pct: 0`, no division error. |
| AC7 | Gemini returns valid JSON with both narratives | Stored as-is, `narrative_source: "ai"`. |
| AC8 | Gemini raises (timeout, HTTP error), returns non-JSON, a non-hash, or misses `overall_narrative` | Report still saved; `narrative_source: "fallback"`; `culture_narrative: null`; fallback text states match/gap/exceed **and** not-assessed counts. |
| AC9 | Engine succeeds | `status: "ready"`, `error_message: null`, `generated_at` set. Re-running updates the same row. |

### Job lifecycle & API
| ID | Given | Then |
|---|---|---|
| AC10 | `POST /portfolios/:id/fitgap`, no report yet | Row created with `status: "generating"`, one job enqueued, `202`. |
| AC11 | `POST` again while `generating` | `202`, **no new job enqueued** (fixes duplicate jobs from polling). |
| AC12 | `POST` when `ready` | `200` with the report, no job. |
| AC13 | `POST` when `failed`, or `regenerate_fitgap` | Back to `generating`, one job enqueued. |
| AC14 | Job exhausts its retries | `status: "failed"`, generic `error_message` (no candidate data, no raw model output — UU PDP). |
| AC15 | `GET /portfolios/:id/fitgap/:vacancy_id` | `200` with `status` for `generating`/`ready`/`failed`; `404` only if no row exists. |
| AC16 | Assessor overrides a skill | Existing reports are **kept** and flipped to `generating` + re-enqueued (not destroyed), so the page never loses its report. |
| AC17 | Report JSON | Adds `status`, `narrative_source`, `summary`, `error_message`. Existing fields unchanged (PDF keeps working). |

### Screen (`FitGapReportPage`, `ComparisonTable`)
| ID | Given | Then |
|---|---|---|
| AC18 | Report ready | "Required" column shows `L{expected_level}` for every row (fixes F2). |
| AC19 | Overridden row | ✏ marker + "human override" legend; AI level shown on hover/secondary text. |
| AC20 | Any report | Coverage line: "Assessed 4 of 6 required skills (67%)" + counts incl. not assessed; partial coverage (< 100%) shows a warning banner. |
| AC21 | `low_confidence` row | Result badge marked "low confidence" so a weak gap is not read as definitive. |
| AC22 | `narrative_source: fallback` | Narrative card labelled "AI summary unavailable — automatic summary", not "Culture & Competency Fit". |
| AC23 | `status: generating` | Loading state; polling uses **GET only**. |
| AC24 | `status: failed` or network/5xx error | Error state with message + "Try again" button; no infinite spinner, no blank page. |
| AC25 | Long skill labels / long narrative / 375 px width | Text wraps, no horizontal page scroll, table readable on mobile. |
| AC26 | Vacancy with 0 skills | Empty state, not an empty table. |

## 4. Options

| | **A. Patch the frontend** | **B. API owns the truth (chosen)** | **C. Rewrite as a 0–100 score** |
|---|---|---|---|
| What | Rename field in web, compute coverage in browser, stop re-POST in polling. | Engine computes flags + summary; report row carries `status` + `narrative_source`; web only renders. | Replace level comparison with a weighted score and new UI. |
| Product impact | Fixes the screen; **PDF/JSON export still lack coverage and source**; no failed state possible (API has none). | Every consumer (screen, PDF, JSON export, future recruiter view) gets the same honest numbers; real failed state. | Potentially richer, but invents a scoring model nobody specified — risky for candidates. |
| Cost | ~0.5 day | ~1.5 days incl. migration + tests | 4+ days, needs product decision |
| Maintainability | Logic split across two languages; drifts again (that is how F2 happened). | One place to change rules (`FitGap::Engine`), typed contract in `types/index.ts` pinned by tests on both sides. | New model to explain and calibrate. |
| Failure modes | Duplicate jobs still possible from other callers; stuck jobs still invisible. | Migration on existing rows (mitigated: additive columns with defaults, reversible); stale `generating` if Sidekiq dies before exhaustion (mitigated: retry button). | Mis-calibrated scores → wrong hires/rejections. |
| Walk-back | Trivial | `rails db:rollback` drops 3 columns; JSON fields are additive. | Hard |
| Forecloses | Nothing, but leaves the trap in place. | Nothing; C can be built on top later. | Comparability with existing reports. |

**Why B:** the bug class is "two services disagree about what the report means". Only B removes that class, and it is the only option that can represent *failed* and *fallback* at all. It fits the deadline because it reuses the existing engine, unique index, Sidekiq retry hooks and UI components.

## 5. Data change (reversible, safe on existing rows)

`fit_gap_reports` + 3 columns:
- `status` string, `NOT NULL`, default `'ready'` → every existing row is a finished report, so it is backfilled correctly by the default.
- `narrative_source` string, nullable → `null` for legacy rows means "unknown", rendered as no label.
- `error_message` text, nullable.
- `skill_comparisons` gets default `[]` so a `generating` row can exist before the engine runs.

`down` removes the columns and the default. No data in existing columns is rewritten.

## 6. Test plan (red first)
1. Commit failing specs for AC2–AC17 (API) and AC18–AC20 (web) **before** the fix — history shows them red.
2. Fix backend → API specs green. Fix web → web tests green.
3. Seeded fault: on a scratch branch, break `coverage_pct` and the `is_override` flag, show the red run, revert.
