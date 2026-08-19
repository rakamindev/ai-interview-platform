# Candidate-Facing View Revamp

Severity: P3 · Type: UX polish → Fixed

## Summary

The interview-complete screen and the "Your data" dialog were both built with zero visual hierarchy: a raw emoji, plain paragraph text, an easy-to-miss underlined text link, and a bordered box of unstyled key/value pairs. A candidate reviewing their own data — the UU PDP access right this same PR just built — landed on a screen that looked unfinished.

## Analysis

`InterviewPage.tsx`'s completed state used a 4xl emoji for status, buried the data-rights action behind a tiny underlined text link with no button affordance, and floated everything directly on the page background with no containing surface.

`MyDataDialog.tsx` rendered the candidate's name and verdict as plain `<span className="font-medium">` labels, the verdict as bare text ("Verdict: failed") with no color coding despite the app already having a verdict badge system used everywhere else (`PortfolioPanel.tsx`, `CandidateManagement.tsx`), and the transcript as a flat list of `<p>speaker: text</p>` lines instead of the chat-bubble component (`TranscriptBubble.tsx`) already built and used during the live interview. The delete action sat at the same visual weight as the rest of the dialog, with no separation signaling "this one is destructive and different."

## Options & Trade-off

**Option A — Leave as-is, since it's functionally correct.**
Rejected. This is the one screen a candidate spends time reading closely — it exists specifically to exercise their UU PDP access/delete rights — and it's also the last thing they see after finishing the interview. A screen that looks unfinished undermines trust in a flow whose entire point is transparency about data handling.

**Option B — Reuse existing patterns rather than invent new visual language (chosen).**
`TranscriptBubble` and `VERDICT_BADGE_CLASSES`/`VERDICT_LABELS` already exist and are already used elsewhere in the app. Reusing them keeps the redesign consistent with the rest of the product instead of adding a third visual treatment for the same data types.

## Solution

- `InterviewPage.tsx` complete state: icon badge in a soft green circle instead of an emoji, card surface (border + shadow) instead of floating text, real outline button for "View or delete your data" instead of a text link.
- `MyDataDialog.tsx`: shield icon in the header, name/status rendered as stat cards, verdict rendered through `VERDICT_BADGE_CLASSES`/`VERDICT_LABELS` as a colored pill, transcript rendered with the same bubble layout as the live interview, delete button moved into a separated "Danger zone" section below a divider.
- Verdict label softened from a bare "failed"/"pass" word to "Assessment status" plus the badge — same data exposed, less blunt presentation for a candidate who may have been rejected.

## Acceptance Criteria

- Interview-complete screen shows a status icon, heading, and a real button (not a text link) for the data-rights action.
- "Your data" dialog shows the verdict as a colored badge matching the same colors used on the assessor's portfolio view.
- Transcript renders as chat bubbles, distinguishing candidate vs. AI turns visually, matching the live-interview transcript style.
- Delete action is visually and structurally separated from the read-only data display.
- No change to what data is fetched, displayed, or deleted — presentation only.

## Tests & Verification

- Vitest: existing `MyDataDialog.test.tsx` and `InterviewPage.myData.test.tsx` suites cover text-content and interaction assertions; both still pass unchanged in behavior, with one heading-casing test expectation reconciled to keep "Interview Complete" exact-match intact.
- Seeded fault: force-disabled the capture-failed branch in the transcript render (`false && data.transcript_capture_failed`), reran `MyDataDialog.test.tsx`, watched the "distinct failure message" test fail against the generic empty state, reverted, reran full suite green (117 Vitest examples). `tsc --noEmit` clean throughout.
