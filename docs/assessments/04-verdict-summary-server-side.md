# Verdict Summary Sentence Moved to the Backend

Severity: P1 · Type: Defective implementation → Fixed

## Summary

The pass/consider/failed verdict badge came from the backend, but the plain-English sentence underneath it ("Strong on React. Less certain on SQL...") was recomputed in the browser from raw skill and override data every time the panel rendered. Two implementations of the same business rule existed: one producing the enum server-side, one producing the sentence client-side. Flagged directly by the person reviewing the feature as unreliable and heading toward tech debt before it grew any larger.

## Analysis

`buildVerdict()` in `utils/portfolioVerdict.ts` re-parsed each skill's `ai_level`, applied its own strength/concern thresholds, and formatted one of several English templates — logic that had nothing to do with rendering and everything to do with business rules that already lived in `Portfolio#recompute_verdict!` for the enum. Any future change to the threshold or wording rule would need to land in two languages, two files, and stay in sync by discipline rather than by construction.

## Options & Trade-off

**Option A — Leave the sentence on the frontend, just clean up the duplication with shared constants.**
Doesn't fix the actual problem: the frontend would still be making a business judgment about what counts as a "strength" or a "concern," a decision that belongs with whoever owns the verdict enum. Rejected.

**Option B — Compute the sentence server-side, store it alongside the enum, serialize it (chosen).**
`Portfolio#recompute_verdict!` already walks every skill to compute the enum average; folding the sentence computation into the same pass costs one more field, one migration, no new trigger. The frontend becomes a pure display layer for both fields.

**Option C — Compute the sentence on-the-fly in the serializer instead of persisting it.**
Avoids a migration, but recomputes on every read instead of once on write, and loses the audit value of "what did we tell the assessor at the time." Persisting matches how the enum itself is already handled.

## Solution

- `verdict_summary:text` column on `portfolios`.
- `Portfolio#recompute_verdict!` now computes both fields in the same skill-iteration pass, ported line-for-line from the deleted `buildVerdict()` logic (strengths ≥4, concerns ≤2 or low-confidence-without-override, same sentence templates for single-skill / all-strong / all-concern / mixed cases).
- Backfill migration for portfolios that already had a verdict enum but no summary.
- `portfolio_json` serializes `verdict_summary`.
- `PortfolioPanel.tsx` renders `portfolio.verdict_summary` directly; `buildVerdict()` and its test file are deleted.

## Acceptance Criteria

- The sentence shown to an assessor matches what the backend computed, byte for byte — no client-side recomputation exists anywhere.
- All prior edge cases from the deleted frontend test suite hold on the backend: no skills → nil, single weak skill → "narrow, inconclusive read" phrasing, all-strong → praise phrasing, mixed → both-named phrasing, low-confidence-without-override treated as a concern, an assessor override cancels a low-confidence flag.
- Existing portfolios with a verdict but no summary get one via backfill.
- `PortfolioPanel.tsx` has zero imports related to verdict wording logic.

## Tests & Verification

- RSpec: `portfolio_spec.rb` ports the full case matrix from the deleted `portfolioVerdict.test.ts` — mixed strengths/concerns, all-strong, single-skill narrow read, low-confidence-as-concern, override-cancels-concern, consistent-performance fallback.
- Vitest: `PortfolioPanel.test.tsx` and `PortfolioPage.test.tsx` updated to assert the panel displays `verdict_summary` verbatim and omits the paragraph when the field is absent, rather than asserting on computed text.
- Seeded fault: replaced one sentence template with a broken string, reran the corresponding RSpec example, watched it fail on the literal mismatch, reverted, reran the full suite green (57 examples).
