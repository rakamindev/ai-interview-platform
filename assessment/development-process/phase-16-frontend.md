# Phase 16 — Frontend changes, explained

Frontend only, mirroring Phases 10 and 12 — no backend code change, since the pagination behavior
this phase relies on already existed. The interesting part of this phase is less "how do I add
pagination" and more "the backend already did this, why didn't the UI use it, and what breaks
silently if you bolt on pagination without thinking about it."

## The gap this phase closes

`api/app/controllers/application_controller.rb#paginate` (Rails' `kaminari`-style pattern, already
used by other index endpoints in this app) has always accepted `page`/`per_page` and
`cv_screening_entries_controller.rb#index` has always returned a `meta` block (`current_page`,
`total_pages`, `total_count`, `per_page`) alongside `entries`. But `cvScreeningsApi.entries()` only
ever sent `decision` — never `page`, never `per_page` — and `CvScreeningDetailPage.tsx` only ever
read `res.data.entries`, never `res.data.meta`. Since the backend defaults to `per_page: 20`, the
table was quietly showing only the newest 20 candidates in every screening, with nothing on screen
suggesting more might exist. This wasn't a backend bug to fix — it was a backend capability the
frontend had simply never been wired up to use.

## Threading page/perPage through the existing fetch mechanism

```ts
// cvScreenings.ts
entries: (id: number, decision?: string, page?: number, perPage?: number) =>
  api.get<{ entries: CvScreeningEntry[]; meta: PaginationMeta }>(
    `/cv_screenings/${id}/entries`,
    { params: { decision, page, per_page: perPage } }
  ),
```

`params` now always passes all three keys, relying on the same axios/JSON.stringify behavior
already used elsewhere in this app (e.g. `reviewEntry`'s optional `email`): a key whose value is
`undefined` is simply dropped from the request rather than sent as the literal string `"undefined"`.

`CvScreeningDetailPage.tsx` adds `page`/`perPage` state and threads both into `loadEntries`'s
existing `useCallback`, adding them to its dependency array exactly the way `decisionFilter`
already works:

```tsx
const loadEntries = useCallback(async () => {
  const res = await cvScreeningsApi.entries(Number(id), decisionFilter || undefined, page, perPage);
  setEntries(res.data.entries);
  setEntriesMeta(res.data.meta);
  ...
}, [id, decisionFilter, page, perPage]);
```

No new `useEffect`, no new polling logic — the page already had `useEffect(() => { loadEntries()
}, [loadEntries, id])` and `usePolling(async () => { await loadEntries(); ... })`; both already
re-run whenever `loadEntries`'s identity changes, which now happens on a page/perPage change too,
for free.

## Two correctness details a naive implementation would have missed

**Resetting to page 1.** Changing the decision-filter tabs or the page-size selector both reset
`page` back to `1` explicitly, in the same event handler that changes the filter/size:
```tsx
const handleFilterChange = (value: string) => {
  setDecisionFilter(value);
  setPage(1);
};
```
Without this, switching from "All" (say, 3 pages) to "Invited" (maybe 1 page) while sitting on
page 3 would silently request a page that doesn't exist for the new filter.

**A page can go stale without the user doing anything.** This app already polls every 5 seconds
while any entry is `pending` (`hasPendingEntries` / `usePolling`). If a recruiter is sitting on,
say, page 3 and enough entries resolve out of the current filter between polls, page 3 might no
longer exist — a case that was structurally impossible before this phase, since there was no page
navigation at all. `loadEntries` guards against it:
```tsx
if (res.data.meta.total_pages >= 1 && page > res.data.meta.total_pages) {
  setPage(res.data.meta.total_pages);
}
```
The `total_pages >= 1` check matters: when a filter genuinely has zero results, `total_pages` is
`0`, and `page (1) > 0` would otherwise be true — but that's the legitimate "no candidates" empty
state, not a stale page to correct.

## Row numbers had to change shape, not just start showing more rows

The row number badge (`index` prop on `EntryRow`) used to be `entries.length - i` — correct only
because every entry was always on the one and only "page" that existed. Paginating without
revisiting this would have made every page's numbers restart at the page size (page 2 would show
10, 9, 8...1 again, duplicating page 1). Fixed by computing each row's true global position:
```tsx
const pageOffset = entriesMeta ? (entriesMeta.current_page - 1) * entriesMeta.per_page : 0;
...
index={totalCount - (pageOffset + i)}
```
So numbering still counts down from the newest candidate overall, uninterrupted across pages.

## The page-size control

`components/ui/select.tsx` — a full Radix `Select` wrapper — already existed in this codebase,
unused by anything. No new UI primitive was needed for the 10/25/50/100 dropdown:
```tsx
<Select value={String(perPage)} onValueChange={(value) => handlePerPageChange(Number(value))}>
  <SelectTrigger className="h-7 w-[68px] text-xs"><SelectValue /></SelectTrigger>
  <SelectContent>
    {PAGE_SIZE_OPTIONS.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
  </SelectContent>
</Select>
```
Radix `Select` values are strings, hence the `String()`/`Number()` conversions at the boundary —
`perPage` itself stays a `number` everywhere else in the component.

## Specs

Backend: one new request-spec case for `GET .../entries` (`per_page`/`page` produce the right
slice and the right `meta`) — proving this endpoint's own use of the shared `paginate` helper
actually works, not just assuming it from the helper's use elsewhere. No production code changed,
so this is pure verification, not a behavior change.

Frontend: no new automated test — `CvScreeningDetailPage.tsx` has no test file today and no prior
phase touching it added one; this phase follows that same precedent and was verified live in the
browser instead (see the phase's live-verification note in `IMPLEMENTATION_PLAN.md`).

## Running it yourself

```bash
cd api && bundle exec rspec spec/requests/api/v1/cv_screening_entries_spec.rb
cd web && npm run typecheck && npm test && npm run build
```
