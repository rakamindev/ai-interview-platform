# Assessor decision workspace

This note is the execution record for the frontend-focused submission. The hiring decision is computed in the client from the fit/gap payload, and the API now sends `required_level` alongside the legacy `expected_level`.

## What was broken

The comparison table read `required_level`. The API stored `expected_level`. Every required level rendered blank, so an assessor could not see the bar they were judging against.

Unassessed skills were a dash in a summary that omitted them. A low-confidence exceed looked like a pass. Culture narrative replaced the overall narrative, so one paragraph hid the other. Long evidence and long role copy had no wrap or collapse. A failed portfolio load failed silently.

## Decision rule

- No requirements, any unassessed skill, or any low-confidence rating: hold.
- A confident gap, and nothing unknown: decline.
- Every required skill at or above the bar, with usable confidence: advance.

The rule lives in `web/src/features/hiring/decision.ts` and is covered by Vitest. The same rule is what the screen renders. It does not invent a level when the payload has none.

## Trade-off

Option A was to wait for a server-side verdict column. That is the safer long-term home for the rule. Option B computes the verdict in the assessor UI from fields the API already returns (`result`, `confidence`, levels), so the screen still has a decision when an older report has no `decision` column. The page now prefers `report.decision` when the API sends it, and falls back to the client rule for reports stored before that column existed.

## Verification

`npm test` in `web/` passes the decision cases, including the hold for an unassessed skill. `npx tsc --noEmit` passes for the application sources.

One generated mistake was caught in review: a mobile comparison card reused a desktop cell fragment inside a flex row, so the label, levels, and badge collapsed into one unreadable line. The mobile layout is now its own stacked card.
