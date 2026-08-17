# Export Result Toast Rendered as One Unreadable Paragraph

Severity: P2 · Type: Defective implementation → Fixed

## Summary

After exporting a batch of candidates with mixed outcomes, the confirmation toast showed every reason and every candidate name run together with no line breaks — a wall of text nobody could actually parse at a glance. Caught from a screenshot during review, not from reading the code.

## Analysis

`toastExportSummary()` built a description string with the grouping logic already in place, but the toast component's description slot renders plain text by default, collapsing any embedded newline the string contained. The data was structured correctly; the rendering wasn't.

## Options & Trade-off

**Option A — Restructure the toast into a custom JSX body with separate lines per group.**
More control over layout, but pulls in a heavier custom-render path for what's fundamentally a text-formatting problem, and diverges from how every other toast in the app is built.

**Option B — Keep the plain-text description, tell it to preserve whitespace (chosen).**
`sonner`'s `descriptionClassName: "whitespace-pre-line"` renders embedded `\n` characters as actual line breaks without touching the toast's structure. One CSS class, no new component.

**Option C — Cap the description to one line and push full detail to a separate modal.**
Solves readability by hiding information instead of formatting it. An assessor exporting a batch wants to see the breakdown immediately, not click through to find it.

## Solution

Added `descriptionClassName: "whitespace-pre-line"` to the toast call in `exportToast.ts`, alongside the existing title (counts) and description (grouped-by-reason lines, capped at 5 names per group with a "+N more" overflow).

## Acceptance Criteria

- A mixed-outcome export shows each status group on its own visual line, not merged into one paragraph.
- A group with more than 5 candidates shows the first 5 names plus a count of the remainder.
- A single-status batch (all `ok`, for instance) shows a clean, short toast with no unnecessary grouping noise.

## Tests & Verification

- Vitest: `exportToast` tests assert the built description string contains the expected newline-separated groups and the overflow-count text for a batch exceeding the cap.
- Manual verification: re-ran the export flow in the browser against a batch with mixed `ok`/`failed`/`not_found` results and confirmed the toast renders each group on its own line.
- Seeded fault: removed `descriptionClassName` from the toast call, confirmed visually the description collapsed back into a single line, restored it.
