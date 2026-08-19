# Phase 14 — Frontend changes, explained

The smallest frontend change in the CV Screening feature so far — a fourth conditional action
button on `EntryRow`, following the exact same shape as the three that came before it
(Invite/Reject from Phase 8, Re-analyze from Phase 13). For the backend reasoning (why
`decision_reason: "cancelled"` exists, and the batch-notification bug this phase also fixes), see
[`phase-14-backend.md`](./phase-14-backend.md).

## The button

```tsx
{isPending && (
  <Button
    disabled={cancelling}
    title="Stop waiting for analysis and move this to Needs review"
    onClick={() => onCancel(entry.id)}
  >
    <Ban className="h-3 w-3 mr-1" />
    Cancel
  </Button>
)}
```

Placed right next to the existing "Processing" indicator — this is the only action ever available
on a `pending` entry, since Invite/Reject/Re-analyze are all gated on `needs_review`. Once clicked,
the entry comes back from the API with `decision: "needs_review"` and `decision_reason:
"cancelled"`, which — because `failedToAnalyze` was widened in the same change to check for either
`"model_failed"` or `"cancelled"` — means Re-analyze becomes available on the very next render,
same row, no extra logic needed to wire that up.

## `CvScreeningDetailPage` — one extra reload target

```tsx
const handleCancel = async (entryId: number) => {
  setCancellingEntryId(entryId);
  try {
    await cvScreeningsApi.cancelEntry(entryId);
    await Promise.all([loadEntries(), loadScreening(), loadBatches()]);
    setCancellingEntryId(null);
  } catch {
    setCancellingEntryId(null);
    setError(true);
  }
};
```

Same `try/catch`-not-`finally` shape as every other handler on this page (see Phase 8's frontend
doc for why). The one difference from `handleReview`/`handleReanalyze`: this one also reloads
`loadBatches()`. That's because cancelling can flip the batch's `notification_status` server-side
(the bug fix described in the backend doc) — the FR5 held-banner reads that value from
`latestBatch`, so without reloading it, cancelling the last stuck entry in a batch wouldn't make an
already-earned held-banner appear until the next unrelated page action happened to trigger a batch
reload.

## What live-testing this confirmed

The whole reason this phase exists was several real entries visibly stuck on "Processing" in the
running app (uploaded while no Sidekiq worker was consuming the job queue). Clicking Cancel on one
of them in the browser flipped it to "Needs review" immediately, with Re-analyze, Invite, and
Reject all available on the same row right away — confirming the full loop (API call → state
change → `failedToAnalyze` picking up the new reason → the right buttons appearing) works
end to end, not just in isolation per component.

## Running it yourself

```bash
cd web
npm run typecheck
npm test
npm run build
```
