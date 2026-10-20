# 02 — Options, Trade-offs & Acceptance Criteria

Written before implementation. The goal is to make "we have no evidence for this skill" a
first-class, honest state from the database to the recruiter's screen.

## 1. Options

### Option A — Hide it in the UI
Keep the data model. When coverage for a skill is `not_yet`, the frontend greys out the L1.

| | |
|---|---|
| Product impact | Low. PDF/JSON exports, fit/gap results, and the LLM narrative still say "Gap". The candidate is still marked down everywhere the screen isn't. |
| Cost | ~0.5 day. |
| Maintainability | Poor. Two sources of truth (stored L1 vs. displayed "unknown"); every new consumer must re-learn the rule. |
| Failure modes | Any export, API client, or future screen shows the fake L1. |
| Fit | Rejected: it hides the defect instead of removing it. |

### Option B — Ask the model to say "not assessed"
Change the prompt so Gemini can return `level: null`, and store null.

| | |
|---|---|
| Product impact | Medium. Fixes the common case. |
| Cost | ~1 day. |
| Maintainability | Fragile. Correctness depends on the model obeying the prompt. |
| Failure modes | The model still invents levels for skills never discussed (the transcript has no evidence, but the prompt asks for a level). Output varies between runs. |
| Fit | Rejected as the primary mechanism. Kept as a secondary input (the model may still return null for thin evidence). |

### Option C — Decide assessability deterministically, let the model only judge evidence (**chosen**)
The system already knows which skills were discussed: `coverage_maps.state`. Use that as the
source of truth.

- `not_yet` / no coverage row → `not_assessed`, never sent to the model for a level.
- Discussed but the model returns no valid level → `insufficient_evidence`.
- Valid level → `assessed`, with **confidence computed from coverage**, not self-reported.

| | |
|---|---|
| Product impact | High. Correct in DB, API, fit/gap, narrative, PDF, and UI from one source. |
| Cost | ~2–3 days: migration, generator rewrite, parser, engine, UI, tests. |
| Maintainability | One rule in one place (`Portfolios::SkillStatus`). Additive migration with a reversible `down`. |
| Failure modes | Coverage analyzer (N7) can lag or fail (`retry: 0`), so a briefly discussed skill may still read `not_yet`. Mitigation: it is shown as "Not assessed", which is the safe direction (no false negative about the candidate), and the assessor can see it in the transcript. |
| Fit | Uses data that already exists, needs no new infrastructure, and the rollback is a single migration. |

### Rejected adjacent ideas
- **PG enum for the new status.** The codebase uses PG enums, but adding or removing values later needs `ALTER TYPE` and cannot be cleanly reversed. Used `string` + `CHECK` constraint instead.
- **Unique index on `(portfolio_id, skill_label)`.** Existing production rows may already contain duplicates (finding P1-5), so the migration could fail on deploy. Prevented at the job level instead (atomic claim); the index is a follow-up after a data audit.
- **Fixing `audio_complete` (P0-3) in this PR.** Its timing with the WebSocket end-of-interview flow can't be exercised without a Gemini key. This PR removes the *harm* (an early end no longer fabricates scores). The endpoint hardening is listed as a follow-up.

## 2. Assumptions (no live Q&A)

1. A skill the interview never reached says nothing about the candidate. It must not count as a gap.
2. An assessor may not override a skill that was not assessed. There is no AI level to override, and inventing one without evidence recreates the bug. The suggested action is a follow-up session.
3. Confidence spec overlap (PRD-01 §5): "medium — probe_count = 2 OR state = partial" vs "low — probe_count <= 1". When both apply (e.g. partial with 1 probe) the **lower** confidence wins.
4. Historical fit/gap reports were computed with the old logic and can't be corrected automatically. Regenerating them is an ops decision (constraint signal).

## 3. Acceptance criteria

### Portfolio generation (api)
| # | Given | Then |
|---|---|---|
| G1 | Configured skill with coverage `covered`, model returns level 3 | `assessed`, level 3, confidence from coverage |
| G2 | Configured skill with coverage `not_yet` | `not_assessed`, level `null`, not included in the model's task list, even if the model returns a level for it |
| G3 | Configured skill with no coverage row at all | `not_assessed` |
| G4 | Discussed skill, model returns `null`, `0`, `6`, `"N/A"`, `3.5`, or omits it | `insufficient_evidence`, level `null`. Never coerced to 1. |
| G5 | Model returns `"3"` or `"L3"` | Accepted as 3 |
| G6 | Model returns confidence `"very high"` | Ignored; confidence is computed from coverage |
| G7 | Coverage covered + probes ≥ 3 → high; probes ≤ 1 or `initiated` → low; otherwise medium | Matches PRD-01 §5, lower wins on overlap |
| G8 | Model returns more than 3 quotes, non-string quotes, or very long quotes | Keep strings only, at most 3, each at most 500 chars |
| G9 | Model returns a skill label not in the coverage map | Ignored (no invented skills) |
| G10 | No skill was discussed at all | Model is **not called**; every configured skill is `not_assessed`; status `complete` |
| G11 | Model response is not JSON / not an object | Status `failed`, error message is generic (no transcript text), job retries |
| G12 | Model times out | Status `failed`, "The AI model timed out", job retries |
| G13 | An invalid row would fail mid-save | Nothing is written; previous skills are intact (transaction) |
| G14 | Same job runs twice (duplicate enqueue) | Second run does nothing; no duplicate skill rows |
| G15 | Portfolio stuck in `generating` > 15 min (worker killed) | A new job may reclaim it |
| G16 | Logs and `generation_error` | Never contain transcript or model output text |

### Fit/gap (api)
| # | Given | Then |
|---|---|---|
| F1 | Vacancy skill matches an assessed skill | match / gap / exceed by delta (unchanged) |
| F2 | Vacancy skill matches a `not_assessed` / `insufficient_evidence` skill | `not_assessed`, `candidate_level: null`, `delta: null`, with the reason |
| F3 | Vacancy skill not part of the interview | `not_assessed`, reason `not_in_assessment` |
| F4 | Override present | `candidate_level` = override, `is_override: true` |
| F5 | LLM narrative fails | Fallback text includes the not-assessed count |
| F6 | Narrative prompt | Explicitly says not-assessed skills are not evidence of weakness |
| F7 | Concurrent jobs for the same pair | No `RecordNotUnique`; last write wins (upsert) |
| F8 | `POST /fitgap` called repeatedly while a job is queued | Only one job is enqueued |

### Overrides (api)
| O1 | Override on a non-assessed skill | 422 with a clear message |

### Frontend
| # | Then |
|---|---|
| W1 | Not-assessed skills render as a distinct card: no level badge, no override button, and an explanation of why plus a suggested next step |
| W2 | Portfolio header summarises "X of Y skills assessed"; when the interview ended early it says why (time limit, connection error, ended by candidate or assessor) |
| W3 | Fit/gap "Required" column shows `expected_level` (seam bug fixed) |
| W4 | Override marker shows only when `is_override` is true |
| W5 | Summary shows match / gap / exceed / not-assessed counts |
| W6 | When required skills are not assessed, a notice says the report can't tell if the candidate meets them |
| W7 | Overall recommendation is shown separately from the culture narrative |
| W8 | Loading, generating, failed (with retry), load error (with retry), empty, and timeout states are all handled; no blank screens |
| W9 | Long labels, quotes, and summaries wrap without breaking the layout; long quotes collapse with "Show more" |
| W10 | Usable at 375 px width: the comparison table becomes stacked rows, and header actions wrap |
| W11 | Fit/gap polling only reads (GET); it never re-triggers generation |
