# Phase 13 — Frontend changes, explained

Small, and follows the exact same shape as the existing Invite/Reject flow (`onReview`/`reviewing`
in `EntryRow.tsx`) — if you understood that pattern from Phase 8, this is the same thing once
more, not a new pattern. For the backend reasoning (why only `model_failed` gets this button, why
no new retry logic was needed), see [`phase-13-backend.md`](./phase-13-backend.md).

## The new service call

`web/src/services/cvScreenings.ts`:
```ts
reanalyzeEntry: (entryId: number) =>
  api.post<{ entry: CvScreeningEntry }>(`/cv_screening_entries/${entryId}/reanalyze`),
```
No body needed — the backend already knows everything it needs from the entry's own current
state.

## `EntryRow` — a third conditional action

The component already had two conditionally-rendered actions (Invite/Reject, shown only for
`needs_review`). This phase adds a third, shown under a narrower condition:

```tsx
const failedToAnalyze = entry.decision_reason === "model_failed";

{isNeedsReview && failedToAnalyze && (
  <Button disabled={reanalyzing} onClick={() => onReanalyze(entry.id)}>
    <RefreshCw className={`h-3 w-3 mr-1 ${reanalyzing ? "animate-spin" : ""}`} />
    Re-analyze
  </Button>
)}
```

It renders *alongside* Invite/Reject, not instead of them — a recruiter looking at a failed entry
might still want to just decide manually rather than wait for a retry, so both options stay
available. The spinning icon while `reanalyzing` is true is the same loading-affordance pattern
already used elsewhere in this app (compare the `Loader2` spin on the "Processing" pill above it).

## `CvScreeningDetailPage` — reusing polling, not adding new polling

```tsx
const handleReanalyze = async (entryId: number) => {
  setReanalyzingEntryId(entryId);
  try {
    await cvScreeningsApi.reanalyzeEntry(entryId);
    await Promise.all([loadEntries(), loadScreening()]);
    setReanalyzingEntryId(null);
  } catch {
    setReanalyzingEntryId(null);
    setError(true);
  }
};
```

This is the exact same shape as the existing `handleReview` — a `try/catch` with the reset call
duplicated in both branches (not `finally` — see the React Compiler note in Phase 8's frontend
doc for why `try/finally` without a `catch` doesn't work with this app's compiler setup). After
the API call succeeds, the entry comes back with `decision: "pending"`. No new polling code was
needed for this: `CvScreeningDetailPage` already polls whenever `entries.some(e => e.decision ===
"pending")` is true, so the moment the reload picks up the freshly-reset entry, polling turns
itself back on automatically and will pick up the eventual real re-decision the same way it
already does for entries still processing from a fresh upload.

## What live-testing this actually caught

Clicking Re-analyze in the running app immediately flipped the row to "Processing," confirming the
reset-and-reload round trip works. Waiting for it to resolve is a genuinely useful reminder that
"processing" isn't instant — a background worker has to actually pick the job up and make a real
network call to Gemini, which in this case hit the *same* transient 503 again. That's not a bug in
this phase — it's the correct outcome, and it's exactly what confirms the safety invariant holds
even on a retry: a second system failure still lands back on `needs_review`, never an automated
rejection.

## Running it yourself

```bash
cd web
npm run typecheck
npm test
npm run build
```
