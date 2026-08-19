# Phase 19 — Frontend changes, explained

A small UI addition. For the backend reasoning (why the data has to come from the batch, not the
screening), see [`phase-19-backend.md`](./phase-19-backend.md).

## What got added

`EntryRow.tsx` — the component that renders one candidate row in the CV screening detail page's
table — now shows a third line below the filename and email, when the entry carries
`vacancy_role_title`/`assessment_name` (the batch's own threshold is appended too, when present):

```tsx
<div className="space-y-0.5 min-w-0">
  <div className="text-sm font-medium truncate" title={displayFilename}>
    {displayFilename}
  </div>
  <div className="text-xs text-muted-foreground truncate">
    {entry.detected_email ?? "No email detected"}
  </div>
  {entry.vacancy_role_title && entry.assessment_name && (
    <div
      className="text-[10px] text-muted-foreground/70 truncate"
      title={`Screened against ${entry.vacancy_role_title} · ${entry.assessment_name}${
        typeof entry.threshold === "number" ? ` · threshold ${entry.threshold}` : ""
      }`}
    >
      {entry.vacancy_role_title} · {entry.assessment_name}
      {typeof entry.threshold === "number" && ` · Threshold ${entry.threshold}`}
    </div>
  )}
</div>
```

It's the smallest text size in the row, muted further than the email line, and truncates with an
ellipsis in a narrow column — same `truncate` + `title` pattern the filename line above it already
uses. Hovering the truncated text shows the browser's own native tooltip with the full "Screened
against {vacancy} · {assessment} · threshold {N}" string — no custom component involved, just the
HTML `title` attribute the browser renders for free. The threshold clause is conditional (checked
with `typeof ... === "number"`) since a batch can have no threshold set at all (`null`), in which
case it's simply omitted from both the visible text and the `title`.

## First pass used a Radix Tooltip + icon — reverted after seeing it live

The original implementation of this phase added a small `Info` icon next to the filename, wrapped
in Radix's `Tooltip`/`TooltipTrigger`/`TooltipContent` (`components/ui/tooltip.tsx` — present in
the codebase since early on, but unused anywhere until that first pass). That required mounting a
`TooltipProvider` once at the app root in `main.tsx`, since Radix's tooltip throws if it renders
without one.

After looking at it in the browser, the simpler inline-subtitle version above replaced it: no new
icon, no new provider, no new interaction pattern — just a third line that behaves exactly like the
filename's existing overflow handling. `main.tsx` and `EntryRow.tsx`'s imports were reverted
accordingly, so `components/ui/tooltip.tsx` goes back to being unused, same as before this phase
started.

## The banner confusion this also fixed

Right after this landed, editing a screening's threshold via `CvScreeningEditPage` (Phase 18) and
then looking at its detail page made it look broken: the "Auto-invite threshold" banner kept
showing the *old* number. It wasn't a bug — that banner already intentionally reads
`latestBatch?.threshold`, the batch's frozen value, for the same reason the vacancy/assessment
subtitle above does: it's reporting what actually decided the candidates already on screen, not the
screening's live setting. But the banner gave no hint *which* threshold it was showing, so
`CvScreeningDetailPage.tsx` gained a second line, shown only when the two values actually differ:

```tsx
const currentThreshold = screening?.threshold ?? null;
const thresholdsDiffer = latestBatch?.threshold != null && latestBatch.threshold !== currentThreshold;
```

```tsx
{thresholdsDiffer && (
  <div className="mt-1.5 pt-1.5 border-t border-border/60">
    This is the threshold that decided your already-uploaded candidates. Your current
    setting is <strong className="text-foreground">{currentThreshold}</strong> — it'll
    apply the next time you upload CVs to this screening.
  </div>
)}
```

`thresholdsDiffer` is only true when the latest batch actually snapshotted its own threshold *and*
that value no longer matches the screening's current one — if no batch has a threshold of its own,
`effectiveThreshold` already equals the current setting and there's nothing to reconcile, so the
extra line stays hidden in the common case.

## The type change

`types/index.ts`'s `CvScreeningEntry` gained three optional fields matching the backend response
shape:

```ts
export interface CvScreeningEntry {
  // ...existing fields...
  vacancy_role_title?: string;
  assessment_name?: string;
  threshold?: number | null;
}
```

Optional, not required — an entry from an older API response shape (or a test fixture that doesn't
set them) simply omits the line rather than crashing or showing "undefined."

## What live-testing this actually confirmed

Opened the "Frontend Engineer" screening (id 2, the same fixture reused across earlier phases'
live-verification) and confirmed each candidate row shows the truncated "Frontend Engineer Senior
· Frontend Engineer Senior" subtitle. Native `title` tooltips render outside the page's paint
layer, so they don't show up in a screenshot — confirmed the full text instead by reading the
element's `title` attribute directly via the DOM, which held the complete "Screened against
Frontend Engineer Senior · Frontend Engineer Senior" string, matching the batch's actual
snapshotted vacancy/assessment names (see the backend doc for why it's the batch's, not the
screening's, current values).

Then edited this same screening's threshold from 80 to 50 (its 13 existing batches all still
snapshot 80) and reloaded: the banner now showed "Auto-invite threshold: 80" plus the new
clarifying line naming the current setting of 50, and each candidate row's subtitle `title` grew a
trailing "· threshold 80" — both correctly reflecting the batch's frozen value rather than the
just-saved live one.

## Specs

`EntryRow.test.tsx` — three tests: the subtitle (located via `getByTitle`) appears when
vacancy/assessment are present, is absent (`queryByText(/Screened against/)`) when they're not, and
includes the threshold — in both the visible text and the `title` — when the entry carries one. 16
tests total in the file, all passing. No new page-level test file, matching the standing precedent
for pages without pre-existing test files.

## Running it yourself

```bash
cd web
npx tsc --noEmit
npm test
npm run build
```
