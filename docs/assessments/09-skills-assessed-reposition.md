# Skills Assessed: Reposition and Restyle

Severity: P3 · Type: Defective implementation → Fixed

## Summary

The list of skills an assessment measures sat at the very bottom of `AssessmentInvitePage.tsx`, below the invite dialog, the newly-created invite link card, and the full candidate table — disconnected from the header where the assessment's name and time limit already live. Moved it directly under the header and restyled it from a bulleted list into a compact chip row.

## Analysis

An assessor opening this page to invite a candidate or check on progress has to scroll past the entire candidate management table to find out what skills the assessment actually measures. That information belongs with the assessment's identity (name, time limit), not buried after the operational content.

## Options & Trade-off

**Option A — Leave the position, just restyle the list.**
Fixes the visual density problem but not the actual complaint: the information is still in the wrong place relative to how someone reads this page top to bottom.

**Option B — Move it under the header, restyle as chips (chosen).**
Reads naturally as a continuation of "here's what this assessment is" (name, time limit, skill count) immediately followed by "here's what it measures" (skill chips), before the page moves on to the operational invite/candidate content.

**Option C — Collapse it into a tooltip or expandable section to save vertical space entirely.**
Hides information the assessor likely wants visible at a glance, trading a real usability need for a marginal space saving. Rejected.

## Solution

Removed the `<Separator />` + `<h2>Skills assessed</h2>` + `<ul>` block from the page bottom. Added a `flex flex-wrap gap-1.5` row of rounded-full chips (`skill_label · expected level`) directly after the header's title/time-limit line, using the same muted badge style already established elsewhere in the app.

## Acceptance Criteria

- The skills list appears directly under the assessment header, before the invite dialog and candidate table.
- Each skill renders as a compact chip showing its label and expected level, not a bulleted list item.
- An assessment with zero configured skills shows no chip row at all, rather than an empty section.
- No existing page content shifts position as a side effect (invite dialog, new-link card, candidate table, all unchanged).

## Tests & Verification

- `tsc --noEmit` clean after the move; no existing test referenced the old bottom position or list markup, confirmed by search before making the change.
- Manual verification: loaded the page locally and confirmed the chip row renders under the header with correct labels and expected levels, and disappears entirely for an assessment with no configured skills.
