# Zero-Skills Portfolio Empty State

Severity: P1 · Type: Defective implementation → Fixed

## Summary

An interview that ended early, or hit an error before the AI could probe the candidate, produces a portfolio with zero assessed skills. `PortfolioPanel.tsx` had no explicit handling for that case — the chart grid, the "Configured Skills" section, and the verdict card all rendered against an empty list, producing a broken, half-populated layout instead of a clear message.

## Analysis

Every downstream component (`SkillLevelChart`, `SkillRadarChart`, the skill card list) assumed at least one skill existed. With zero, charts rendered with nothing to plot and empty section headers sat above nothing, giving an assessor no explanation for why the page looked wrong — was this a bug, or did the interview genuinely produce no data?

## Options & Trade-off

**Option A — Hide the whole portfolio page and redirect elsewhere.**
Too aggressive: the assessor still needs to reach the transcript and the Fit/Gap section, which don't depend on skills existing.

**Option B — Explicit empty state replacing only the skills-dependent section, everything else renders normally (chosen).**
An empty-state card explains what happened (interview ended early or hit an error) and links to the transcript so the assessor can investigate. Fit/Gap analysis below it still renders untouched, since that's a separate concern from skill assessment.

**Option C — Silently render nothing for the skills section, no message at all.**
Leaves the assessor without any explanation, same underlying problem as the original bug, just less visually broken.

## Solution

`PortfolioPanel.tsx` checks `portfolio.skills.length === 0` first and returns a dedicated empty-state block: an icon, a one-sentence explanation, and a "View transcript" link — before any chart or skill-card code runs. The verdict card, chart grid, and Configured/Discovered Skills sections never mount in this case.

## Acceptance Criteria

- A portfolio with zero skills shows the empty-state message, not a broken chart grid.
- The empty state links directly to that session's transcript.
- The verdict card, "Skill Levels" / "Skill Profile" charts, and "Configured Skills" heading are all absent when there are zero skills — not empty versions of themselves.
- Fit/Gap analysis still renders below the empty state.
- A portfolio with at least one skill renders the normal layout, not the empty state.

## Tests & Verification

- Vitest: `PortfolioPage.test.tsx` and `PortfolioPanel.test.tsx` cover the empty-state message and transcript link, the absence of verdict/chart/skills sections, Fit/Gap still rendering, and the normal layout returning once at least one skill exists.
- Seeded fault: removed the `skills.length === 0` early return, reran the empty-state test, watched it fail on the missing empty-state text, restored, reran green.
