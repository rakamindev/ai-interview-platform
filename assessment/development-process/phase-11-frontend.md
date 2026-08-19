# Phase 11 — Frontend changes, explained

A new `Dialog` usage in `EntryRow.tsx` — the primitive already existed in `components/ui/dialog.tsx`
(shadcn-style, wrapping Radix's dialog) but nothing in the app used it yet. For the backend
reasoning (why this is required at all, what breaks without it), see
[`phase-11-backend.md`](./phase-11-backend.md).

## The service call gains an optional param

`web/src/services/cvScreenings.ts`:
```ts
reviewEntry: (entryId: number, action: "invite" | "reject", email?: string) =>
  api.post<{ entry: CvScreeningEntry }>(`/cv_screening_entries/${entryId}/review`, {
    action,
    email,
  }),
```
When `email` is `undefined` (the common case — an entry that already has a detected email),
`JSON.stringify` drops it from the request body entirely, so existing callers are unaffected — the
backend never even sees an `email` key for those requests.

## `EntryRow` — intercepting the click, not the request

Previously, clicking Invite/Reject called `onReview(entry.id, action)` straight away. Now that
call is gated behind a check:

```tsx
const requestReview = (action: "invite" | "reject") => {
  if (!entry.detected_email) {
    setEmailInput("");
    setPendingAction(action);
    return;
  }
  onReview(entry.id, action);
};
```

`pendingAction` (`"invite" | "reject" | null`) doubles as both "which action is the user
confirming" and "is the dialog open" — `<Dialog open={pendingAction !== null} ...>`. Setting it to
`null` (on cancel, on `onOpenChange`, or after a successful confirm) closes the dialog. This
mirrors the existing `reviewingEntryId`/`reanalyzingEntryId` pattern in `CvScreeningDetailPage`
(nullable ID as both "which one" and "is something in flight"), just scoped to this component
instead of the page.

The dialog itself is a single controlled `Input`, gated by a basic client-side format check before
Confirm is enabled:

```tsx
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailValid = EMAIL_PATTERN.test(emailInput.trim());
// ...
<Button disabled={!emailValid || reviewing} onClick={confirmReviewWithEmail}>Confirm</Button>
```

This is deliberately looser than the backend's `URI::MailTo::EMAIL_REGEXP` — it exists only for
fast feedback (don't let someone submit `"asdf"`), not as the real validation. The server remains
the source of truth and re-validates independently; a client-side false positive just means an
extra round trip to a `422`, never a security or correctness issue.

## Why no new page-level state was needed

`CvScreeningDetailPage.tsx#handleReview` only grew one param:

```tsx
const handleReview = async (entryId: number, action: "invite" | "reject", email?: string) => {
  ...
  await cvScreeningsApi.reviewEntry(entryId, action, email);
  ...
};
```

Everything else — the dialog's open/closed state, the typed email value — lives entirely inside
`EntryRow`, local to the row that needs it. The page component doesn't need to know a dialog
exists at all; it just receives a call to `onReview` with an extra argument some of the time,
exactly as before.

## Specs

`EntryRow.test.tsx` gains three cases: clicking Invite on a no-email entry opens the dialog instead
of calling `onReview`; Confirm stays disabled for an empty or invalid-format value and calling
`onReview(id, action, email)` once a valid one is typed; and — guarding against a regression of the
*existing* behavior — an entry that already has a `detected_email` still calls `onReview`
immediately with no dialog at all.

## Running it yourself

```bash
cd web
npm run typecheck
npm test
npm run build
```
