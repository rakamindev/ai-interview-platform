# Mobile Responsiveness: Nav, Portfolio Toolbar, Candidate Table

Severity: P2 · Type: Defective implementation → Fixed

## Summary

On a mobile viewport, the global assessor header wrapped its brand name, nav links, tenant badge, and logout into a chaotic 3-line stack; the portfolio page toolbar (Transcript/PDF/JSON/Compare) squeezed four buttons into one non-wrapping row until the Compare button became unreachable or visually overlapped its neighbor; and the candidate table's fixed-width status/verdict/actions columns starved the name column down to a single visible letter. Reported directly from screenshots taken on a real mobile viewport, not from a code read.

## Analysis

Three components, one shared root cause: none had a mobile breakpoint at all.

- `AssessorLayout.tsx:30-67` — a fixed `h-14` single-row flex with brand text, two nav links, a tenant badge, and a logout button all competing for the same row with no wrap and no responsive hiding.
- `PortfolioPage.tsx:187-230` — the toolbar's `flex gap-2 shrink-0` had no wrap fallback, so four buttons with full text labels had nowhere to go on a narrow screen.
- `CandidateManagement.tsx:344-390` — each row was a non-wrapping `flex` with fixed `w-24`/`w-20`/`w-32` siblings for status/verdict/actions, leaving the `flex-1 min-w-0 truncate` name column almost no width once those siblings claimed their share.

## Options & Trade-off

**Option A — Rewrite the header/toolbar/table as new mobile-first components.**
Highest long-term payoff, but far more surface area and risk than the actual defect calls for; none of these components are broken on desktop.

**Option B — Add responsive breakpoints and icon-only fallbacks to the existing components, restack the candidate row on mobile (chosen).**
Keeps every desktop layout pixel-identical (verified — no `sm:` prefix changes anything above the breakpoint) and fixes the actual reported defect with `hidden sm:inline` label toggles, `flex-wrap`, and a `flex-wrap sm:flex-nowrap` row that stacks fields vertically below `sm`.

**Option C — Hide non-essential elements entirely on mobile instead of collapsing to icons.**
Loses functionality (a candidate on mobile still needs Compare, PDF, JSON) for a cosmetic fix. Rejected — the standing design-quality rule treats hiding functionality as worse than a slightly denser icon row.

## Solution

- `AssessorLayout.tsx`: brand text, nav labels, and logout label hide below `sm` (icon remains, `aria-label` added so the accessible name survives); tenant badge hides below `md` since it's the least load-bearing element in a space crunch.
- `PortfolioPage.tsx`: same `hidden sm:inline` pattern extended to PDF/JSON/Compare (Transcript already had it), toolbar gains `flex-wrap` as a fallback, every icon-only button gets an explicit `aria-label` (`Download PDF`, `Download JSON`, `Compare`/`Hide compare panel`).
- `CandidateManagement.tsx`: table header row hides below `sm` (a column header row makes no sense once fields stack vertically); each candidate row becomes `flex-wrap sm:flex-nowrap`, status/verdict lose their fixed width below `sm` (`sm:w-24`, `sm:w-20`) so they can wrap onto their own line, and the actions group becomes `w-full sm:w-32` so it claims the full row width on mobile instead of competing with the name for space.

## Acceptance Criteria

- Desktop layout (`sm` and above) is pixel-identical to before this change.
- No interactive element loses its accessible name when its text label is visually hidden below `sm`.
- The candidate table's name column is never starved to a single character by its row siblings on a narrow viewport.
- The portfolio toolbar wraps to a second row rather than squeezing or overlapping buttons if four icon buttons still don't fit one row.

## Tests & Verification

- Vitest: new `AssessorLayout.test.tsx` (nav links, logout keep their accessible name), new assertions in `PortfolioPage.test.tsx` (Transcript/PDF/JSON/Compare all resolve by accessible name), two new assertions in `CandidateManagement.test.tsx` (full candidate name renders as one text node regardless of row width; the actions group carries the mobile-stacking class).
- Seeded fault: removed the `w-full` class from the candidate row's actions wrapper, reran the suite, watched the new stacking assertion fail on the missing class, restored, reran green (122 Vitest examples). A parallel attempt to seed-fault the `AssessorLayout` aria-label surfaced a real limitation instead of a bug: jsdom doesn't apply real CSS, so `hidden` never actually removes the label from the accessibility tree in tests, meaning that specific test can't be seed-proven the way the others were — it still documents the intended behavior and is correct for a real browser, but its regression-catching power is honestly weaker than the candidate-row test. Noted rather than silently claimed as proven.
- `tsc --noEmit` clean.
