# Phase 20 — Frontend changes, explained

Pure deletion — this phase removes UI that a backend change made permanently unreachable. For the
backend reasoning (the bug that was found first, then the deliberate gate removal that followed),
see [`phase-20-backend.md`](./phase-20-backend.md).

## What got removed, and why it was safe to

`CvScreeningBatch#notification_status` could never become `'held'` again once
`CvScreenings::BatchNotifier` stopped setting it (see the backend doc). `CvScreeningDetailPage.tsx`
had a whole banner that only rendered for that one state:

```tsx
{latestBatch?.notification_status === "held" && (
  <div className="border border-amber-400/50 bg-amber-50 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
    <p className="text-sm text-amber-800">
      Every candidate in the latest batch resolved the same way — review before we notify
      them.
    </p>
    <Button size="sm" onClick={handleConfirmBatch} disabled={confirming}>
      {confirming ? "Confirming…" : "Confirm & send"}
    </Button>
  </div>
)}
```

Once the condition can never be true for any newly-processed batch, this isn't dead-in-spirit code —
it's dead code, full stop. Removed:

- The JSX block above.
- `handleConfirmBatch`, its only caller.
- The `confirming` `useState` — read and written only by the handler and the button that's gone.
- `cvScreeningsApi.confirmBatch` in `services/cvScreenings.ts` — its only caller was
  `handleConfirmBatch`, so once that's gone, the API wrapper has no callers anywhere in the app
  either (confirmed via a full-repo grep before removing it).

## What deliberately stayed

The backend's `notification_status` field itself, the `'held'` value in its validation list, and the
`CvScreeningBatch` type in `types/index.ts` are all untouched — a batch already sitting at `'held'`
in the database from before this change is still a structurally valid record; only the *trigger* for
reaching that state (both the backend logic that set it and the frontend UI built around it) is
gone. See the backend doc for why leaving the enum value costs nothing.

## What live-testing this confirmed

Reloaded a CV screening detail page after the removal and confirmed the page renders cleanly
straight from the auto-invite threshold banner into the summary cards — no gap, no leftover spacing
issue, nothing referencing the removed section.

## Specs

No test file exists for `CvScreeningDetailPage.tsx` (consistent with the standing precedent — pages
in this codebase don't get test files; only shared/reusable components do), so no spec changes were
needed here.

## Running it yourself

```bash
cd web
npx tsc --noEmit
npm test
npm run build
```
