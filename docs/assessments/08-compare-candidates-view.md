# Side-by-Side Candidate Comparison

Severity: P2 · Type: Missing specification → Adds

## Summary

An assessor reviewing one candidate's portfolio had no way to see another candidate's results without leaving the page, losing their place, and navigating back and forth. Added a Compare button that opens a second, read-only portfolio panel beside the current one, with a searchable picker to choose who to compare against.

## Analysis

`PortfolioPage.tsx` rendered exactly one portfolio, full width, with no concept of a second candidate in view at all. Comparing two candidates meant two browser tabs or writing notes down separately — a real gap for anyone screening more than a couple of candidates for the same role.

## Options & Trade-off

**Option A — Fixed-width sidebar (420px) with stacked charts.**
First attempt. Rejected after a live screenshot review: not responsive, and the fixed width made the comparison panel feel cramped against the main content on smaller screens.

**Option B — Fixed-width sidebar (460px) with side-by-side charts inside it.**
Second attempt, fixing the chart-stacking issue. Still rejected — the reviewer wanted the current candidate and the compared candidate to have the *same* sizing, not a full-width primary panel next to a narrow secondary one.

**Option C — Equal-width two-column grid, both panels full-featured (chosen).**
`grid grid-cols-1 lg:grid-cols-2` gives both candidates identical width and identical chart layout. The container itself widens (`max-w-2xl` → `max-w-7xl`) only when comparing, so the single-candidate view isn't penalized by extra whitespace the rest of the time.

## Solution

- `CompareCandidatePicker.tsx` — searchable list of other completed candidates for the same assessment, debounced search, excludes the current session.
- `SkillPortfolioCard` gains a `readOnly` prop that suppresses the override control, since assessors shouldn't edit a candidate they're only comparing against.
- `PortfolioPage.tsx` toggles a `compareOpen` state; the right panel animates in with a CSS-only transition (translate + opacity, 300ms) triggered 20ms after `compareOpen` flips, so the entrance reads as a slide rather than a snap.
- Compare button sits beside the JSON download button in the toolbar, per explicit placement direction during planning.

## Acceptance Criteria

- Clicking Compare opens a picker in a right-hand panel; the current candidate's panel keeps its full width until a comparison target is picked.
- Picking a candidate loads their portfolio read-only: no override controls anywhere in the right panel.
- Changing the comparison target returns to the picker without losing the left panel's state.
- Closing compare collapses back to the single-candidate width.
- A candidate whose portfolio fails to load shows an explicit error state in the right panel, not a silent blank space.
- The picker excludes the currently-viewed candidate and only lists candidates with a completed interview.

## Tests & Verification

- Vitest: `CompareCandidatePicker.test.tsx` (list, exclude self, empty state, error state, debounced search), `PortfolioPage.test.tsx` compare-suite (opens picker, loads read-only portfolio with a single override control visible only on the left panel, returns to picker on Change, closes cleanly, shows an error state on load failure, hides Compare while the portfolio is still generating).
- Seeded fault: removed the `readOnly` guard from `SkillPortfolioCard`, reran the "only one override control visible" assertion, watched it fail with two controls present, restored, reran green.
