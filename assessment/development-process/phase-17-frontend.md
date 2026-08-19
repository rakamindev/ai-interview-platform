# Phase 17 — Frontend changes, explained

The main new thing here is a shared component — the first one in this app's `components/`
top level (alongside `ErrorBoundary.tsx`, `HardwareCheck.tsx`, etc.) rather than under a
feature folder like `cvScreening/`, since it's genuinely reused by three unrelated pages. For the
backend reasoning (why two of these three delete endpoints were already broken before this phase,
why the eligibility check is re-verified server-side, why the attachment cleanup matters), see
[`phase-17-backend.md`](./phase-17-backend.md).

## `DeleteResourceDialog` — one state machine, three call sites

```tsx
type Phase = "closed" | "checking" | "blocked" | "confirm" | "deleting";
```

Clicking the trigger button either goes straight to `"confirm"` (CV Screening — no
`checkEligibility` prop, since nothing blocks it) or calls the passed-in `checkEligibility()`
first, landing on `"blocked"` or `"confirm"` depending on what comes back. This mirrors the backend
doc's point directly: the frontend check exists purely to pick which dialog the recruiter sees
first, not as the real safety boundary — if `checkEligibility` itself fails (a network blip), the
component fails *open* to the confirm step rather than open, since `#destroy` re-verifies
server-side regardless:

```tsx
try {
  const result = await checkEligibility();
  result.deletable ? setPhase("confirm") : (setBlockInfo(result), setPhase("blocked"));
} catch {
  setPhase("confirm"); // not a security gap — destroy re-checks independently either way
}
```

## Why this uses plain `Button`s instead of `AlertDialogAction`

This app already had an established confirm-dialog pattern — `AlertDialog`, used twice before this
phase (e.g. `LiveMonitorPage.tsx`'s "End the session now?"). Both existing usages are simple,
synchronous confirms: click `AlertDialogAction`, it closes the dialog and runs the handler. Radix's
`AlertDialogPrimitive.Action` **closes the dialog automatically on click** — fine for a
synchronous confirm, but this component needs to stay open through an async delete call, and
transition to a different view (an inline error) if that call fails rather than assuming success
and closing. Since the dialog's visibility here is already fully controlled
(`<AlertDialog open={...} onOpenChange={...}>`, not relying on Radix's own internal open state via
an uncontrolled `AlertDialogTrigger`), there's no need for `AlertDialogAction`'s auto-close
behavior at all — the Confirm/Cancel/Close buttons are plain `Button`s inside `AlertDialogFooter`
(which is purely a styling wrapper, not tied to Radix's action/cancel semantics), and the component
manages exactly when the dialog closes itself.

## The blocked view — reusing exactly what the backend sent

```tsx
{blockInfo.blocking_cv_screenings?.map((cs) => (
  <li key={cs.id}>
    <span>{cs.name}</span>
    <Button asChild variant="outline" size="sm">
      <Link to={`/cv-screenings/${cs.id}`}>View →</Link>
    </Button>
  </li>
))}
```

No separate lookup — the `deletion_check` response already carries `{ id, name }` for every
blocking CV screening (see the backend doc's `deletion_blockers` helper), so the list and its
navigation targets come straight from that one response. `Button asChild` (the `@radix-ui/react-slot`
pattern already used elsewhere in this UI kit) renders the `Link` *as* the button rather than
nesting an anchor inside a `<button>`, which would be invalid HTML.

## Wiring differences across the three pages

- **`CvScreeningDetailPage.tsx`** had no header button row at all before this phase — added one,
  matching the `flex items-start justify-between` shape `AssessmentInvitePage.tsx` already used.
- **`AssessmentInvitePage.tsx`** already had a button row (Edit, Invite Candidate) — Delete just
  joins it as a third button.
- **`VacancyEditPage.tsx`** has no header button row *or* a separate detail page distinct from its
  edit form — Delete was added to the existing bottom `flex justify-end gap-2` form-action row,
  switched to `justify-between` so it sits apart on the left from Cancel/Save on the right (the
  usual "destructive action separated from the primary flow" convention). Getting the vacancy's
  own name for `resourceName` needed one extra line, since this page never kept the loaded
  `Vacancy` object in its own state — only inside `react-hook-form`'s internal state via `reset()`
  — so it reads it the same way the page already reads `public_requirement_text` for its character
  counter: `useWatch({ control, name: "role_title" })`, not a second fetch or a new state variable.

## Specs

`DeleteResourceDialog.test.tsx` covers both blocked variants (CV-screenings, with its list and
links; sessions, with no list), the type-to-confirm gate staying disabled until an exact match,
the no-`checkEligibility` path going straight to confirm, and an inline error surfacing (without
calling `onDeleted`) when `onConfirmDelete` itself rejects. No new tests for the three pages
themselves — none of them had a test file before this phase and no prior phase touching any of
them added one; this phase follows that same precedent and was verified live instead (see the
live-verification note in `IMPLEMENTATION_PLAN.md`'s Phase 17 entry, including creating and
deleting a disposable vacancy end to end to prove the full flow, not just the blocked path).

## Running it yourself

```bash
cd web
npm run typecheck
npm test
npm run build
```
