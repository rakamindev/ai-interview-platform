# Acceptance criteria: trustworthy skill ratings

Written before implementation. Each criterion maps to at least one automated test
(RSpec in `api/spec`, Vitest in `web/src/**/__tests__`).

## Vocabulary

- **Rated**: the skill has an AI level (L1–L5) that is backed by at least one candidate
  quote that really appears in the transcript.
- **Not assessed**: the interview never reached the skill (coverage `not_yet`, or zero probes).
  No level is stored.
- **Insufficient evidence**: the skill was discussed, but the model returned no usable level,
  or none of the quotes it gave can be found in what the candidate actually said.
  No level is stored.

A missing level is never shown, exported or compared as L1.

## Portfolio generation (N10)

| # | Input / situation | Expected behaviour |
|---|---|---|
| G1 | Configured skill with coverage `not_yet` or `probe_count = 0` | Stored as `not_assessed`, `ai_level = NULL`, whatever the model says. The model is not asked to rate it. |
| G2 | Model omits a configured skill from its JSON | Stored as `insufficient_evidence`; the skill still appears in the portfolio. |
| G3 | Model returns `level` null, 0, 7, `"L3"`, `"three"` | `"L3"` is read as 3. Anything outside 1–5 → `insufficient_evidence`. Never clamped. |
| G4 | Model returns confidence that contradicts coverage | Ignored. Confidence comes from coverage: high = covered and ≥ 3 probes; medium = 2 probes or partial; low otherwise. |
| G5 | Evidence quote not found in any candidate turn (fabricated, or said by the AI) | Dropped. Kept quotes carry the transcript turn number they came from. |
| G6 | Rated skill whose quotes were all dropped | Downgraded to `insufficient_evidence`. |
| G7 | Very long quotes or summaries | Quotes capped at 500 chars, summaries at 2,000; at most 3 quotes per skill. |
| G8 | Transcript has no candidate turns (mic failure, instant drop-off) | Model is not called. Every configured skill is `not_assessed`. Portfolio completes. |
| G9 | Model call times out or errors | Portfolio becomes `failed` with a short error that holds no transcript text. Sidekiq retries. |
| G10 | Model returns non-JSON | Same as G9. |
| G11 | Failure halfway through saving skills | Nothing is half-written: the previous skills stay as they were (single transaction). |
| G12 | Two generation jobs for the same session at the same time | Only one runs. The other exits without calling the model. |
| G13 | A job crashed and left the portfolio `generating` for more than 10 minutes | A new job may take it over. |
| G14 | Regeneration after an assessor override | The override survives, attached to the same skill. |
| G15 | Discovered skill | Same evidence rules. Confidence comes from its discovered coverage row, or `low` if there is none. |

## Assessor override

| # | Input | Expected |
|---|---|---|
| O1 | Override without notes | 422. A human change to a candidate's rating needs a written reason. |
| O2 | Override on a `not_assessed` or `insufficient_evidence` skill | 422. There is no AI rating to correct; the right action is a follow-up interview. |
| O3 | Level outside 1–5 | 422 |
| O4 | Portfolio skill from another tenant | 404 (no hint that it exists) |
| O5 | Saving an override | Existing fit/gap reports for the portfolio become stale and are regenerated. |

## Fit/gap (N13)

| # | Input | Expected |
|---|---|---|
| F1 | Vacancy skill missing from portfolio, `not_assessed`, or `insufficient_evidence` (no override) | `result = not_assessed`, `candidate_level = null`. Not counted as a gap and not sent to the model as a gap. |
| F2 | Overridden skill | Override level is used, `overridden = true`, AI level still reported. |
| F3 | Rated with low confidence | Compared as usual, `low_confidence = true` so the UI asks for verification. |
| F4 | Same skill matched by `skill_id` first, then by label (case- and space-insensitive) | Matches. |
| F5 | Narrative model call fails | Report is still saved. Fallback narrative counts not-assessed skills separately and is marked as automatic. |
| F6 | Override or vacancy changes after a report was generated | Report is returned with `stale = true`. The UI offers to regenerate. |
| F7 | Two fit/gap jobs for the same pair at the same time | One report row. No unique-index crash. |
| F8 | Portfolio or vacancy from another tenant | 404 |
| F9 | Repeated POST /fitgap while a job is running | At most one job is enqueued per pair per 2 minutes. |

## Results UI

| # | State | Expected |
|---|---|---|
| U1 | Loading | Skeleton |
| U2 | Generating | Progress message with elapsed time. Polling stops once complete or failed. |
| U3 | Failed | The error and a retry button. Retry failure is shown, not swallowed. |
| U4 | Not assessed / insufficient evidence | No level badge. A clear label, the reason, and that it is not counted against the candidate. Override is disabled. |
| U5 | Rated | Level, confidence, and why (probes and coverage). Quotes link to the transcript turn. |
| U6 | Override | Reason required before saving. Server error is shown inline. |
| U7 | Fit/gap table | Required level is shown (it was always blank before). Not-assessed rows are neutral and excluded from gap counts. Low-confidence rows are flagged. |
| U8 | Fit/gap job never finishes | Polling stops after 2 minutes and shows an error with a retry. It does not enqueue a new job on every poll. |
| U9 | Long skill names, quotes, narratives | Wrap without breaking layout. Long summaries collapse with "Show more". |
| U10 | Phone width (375px) | No horizontal page scroll. The comparison table becomes stacked cards. |
