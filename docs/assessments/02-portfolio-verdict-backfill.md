# Backfill Verdicts for Existing Portfolios

Severity: P0 · Type: Defective implementation → Fixed

## Summary

A hiring manager opened a completed candidate's portfolio and saw no verdict badge at all, despite the candidate having assessed skills. The verdict feature computed `pass`/`consider`/`failed` correctly for any *new* portfolio, but every portfolio generated before that feature shipped had `verdict: nil` frozen in the database, with nothing to trigger a recompute.

## Analysis

`Portfolio#recompute_verdict!` runs after generation (`Portfolios::Generator`) and after any assessor override save. Both call sites only fire on write events that happen going forward. A portfolio that finished generating last week, before this column existed, never re-triggers either path — it sits at `nil` forever unless something explicitly walks back over it.

This was caught live, from a screenshot, not from a code read: the reviewer opened a real candidate's portfolio and the verdict card was simply absent.

## Options & Trade-off

**Option A — Wait for the next override to trigger a recompute.**
Zero code. Leaves every existing completed portfolio wrong until an assessor happens to touch it, which may be never for a candidate nobody revisits. Rejected — this is the exact failure the reviewer already witnessed.

**Option B — One-time reversible data migration that recomputes affected rows (chosen).**
`Portfolio.where(generation_status: "complete", verdict: nil).find_each(&:recompute_verdict!)`. Touches only the rows actually missing a verdict, reuses the exact method that computes it correctly for new data, so there's no second implementation to keep in sync.

**Option C — Backfill via a Rake task instead of a migration.**
Works, but a migration runs automatically on every environment (staging, CI, teammates' machines) the moment they migrate, whereas a Rake task needs someone to remember to run it. Rejected for the same reason `down` is documented as irreversible: reproducibility matters more than a slightly cleaner migrations directory.

## Solution

Migration `20260817160000_backfill_portfolio_verdicts.rb` finds every complete portfolio with a nil verdict and calls the existing `recompute_verdict!`. The `down` method is intentionally a no-op with a comment explaining why: there's no way to distinguish a verdict that was nil because it was never computed from one that's genuinely nil (zero assessed skills), so reversing this migration cannot be done safely.

## Acceptance Criteria

- Every `complete` portfolio with assessed skills and a nil verdict gets a correct verdict after migrating.
- A portfolio with zero skills stays nil (a nil verdict is a legitimate state, not always a bug).
- Running the migration twice is a no-op the second time — nothing left to backfill.
- New portfolios generated after this migration continue to get their verdict from the existing generation/override hooks, unaffected.

## Tests & Verification

- RSpec: `portfolio_spec.rb` covers `recompute_verdict!` producing `pass`/`consider`/`failed`/nil from various skill-level averages, and using the assessor override level over the raw AI level when one exists — the same logic the backfill migration calls.
- Manual verification: ran `db:migrate` against the local database and confirmed the previously-blank verdict badge appeared for the candidate from the original screenshot.
- Seeded fault: temporarily broke the pass/consider/failed threshold logic, reran the model spec, watched it fail on the exact average-boundary case, reverted, reran green.
