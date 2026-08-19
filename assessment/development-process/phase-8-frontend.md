# Phase 8 — Frontend changes, explained

You already know React, TypeScript, and npm. This phase is the first one with a real UI — Phases 5–7 were pure backend, building the pipeline this phase now gives a face to. There's no new *tool* here (no new devDependency) — everything below is the project's existing conventions (raw `useEffect` fetching, react-hook-form with inline rules, shadcn-style primitives, a hand-written service layer) applied to three new pages and two new components. This doc walks through the patterns that are new to *this feature*, not new to the toolchain.

For backend terms (Rails migration, decision engine, FR5) see [`phase-8-backend.md`](./phase-8-backend.md).

## 1. The service layer — `src/services/cvScreenings.ts`

Every API resource in this app gets a hand-written object of arrow functions returning raw axios promises — no React Query, no generated client. This phase's version has two calls worth a closer look because they don't fit the usual "just call `api.get`/`api.post`" shape.

### Multipart upload with progress

```ts
uploadBatch: (id: number, files: File[], onProgress?: (percent: number) => void) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files[]", file));
  return api.post<{ batch: CvScreeningBatch; entries: CvScreeningEntry[] }>(
    `/cv_screenings/${id}/batches`, formData,
    {
      headers: { "Content-Type": undefined },
      onUploadProgress: (event) => {
        if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
      },
    }
  );
},
```

Two things that aren't obvious if you've only used `fetch`/`FormData` casually:

- **`headers: { "Content-Type": undefined }`** — this app's axios instance sets `Content-Type: application/json` globally for every request (see `src/services/api.ts`). A multipart upload needs `multipart/form-data; boundary=...` instead, but the boundary is a random string the browser generates *when it serializes the FormData* — you can't set it yourself. Explicitly clearing the header on this one call is what lets axios/the browser fill in the correct value; leaving the global JSON header in place would send a `FormData` body with a `Content-Type: application/json` header, which every real multipart parser rejects.
- **`onUploadProgress`** — an axios-specific option (not part of `fetch`) that fires repeatedly during the upload with cumulative byte counts. `UploadDropzone` (§3) uses this to drive a real progress bar rather than an animated fake one.

### Authenticated file download

```ts
downloadFile: async (entryId: number, filename?: string) => {
  const res = await api.get(`/cv_screening_entries/${entryId}/file`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([res.data as BlobPart]));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename ?? "cv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
},
```

A plain `<a href="/api/v1/cv_screening_entries/1/file" download>` can't work here: the browser's own navigation for a bare link doesn't carry the app's `Authorization: Bearer <token>` header, so the request would 401. Instead: fetch the file as a `blob` via the authenticated axios instance (which *does* attach the header), wrap it in an object URL (`createObjectURL`, a browser API that hands back a temporary `blob:` URL pointing at in-memory data), synthesize an `<a download>` element pointing at that URL, and click it programmatically. `revokeObjectURL` afterward frees the memory — object URLs aren't garbage-collected automatically. This pattern is generic enough that any authenticated-download feature in this app going forward should reuse it rather than reinventing it.

## 2. Types — `src/types/index.ts`

New interfaces mirror the backend response shapes 1:1 — `CvScreening`, `CvScreeningBatch`, `CvScreeningEntry`, plus a `CvScreeningSummary` and two string-literal union types:

```ts
export type CvScreeningNotificationStatus = "pending" | "held" | "released";
export type CvScreeningDecision = "pending" | "needs_review" | "invited" | "not_advanced";
```

These aren't just documentation — using a union instead of `string` means `EntryRow`'s `switch (entry.decision)` (§4) gets exhaustiveness checking from TypeScript: add a fifth decision value on the backend and forget to handle it in a component, and `tsc` flags it rather than silently rendering nothing.

## 3. `UploadDropzone` — drag-and-drop over a hidden file input

The actual native drag-and-drop API is three DOM events, wired directly (no library):

```tsx
<div
  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
  onDragLeave={() => setDragging(false)}
  onDrop={(e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }}
>
```

`e.preventDefault()` on `onDragOver` matters more than it looks — without it, the browser's *default* drag behavior (usually "navigate to this file") wins and `onDrop` never fires at all. `dragging` is just local state driving a Tailwind class swap for the highlight-on-hover-while-dragging effect.

The "Browse files" button doesn't open a file picker itself — it proxies a click to a real, visually hidden `<input type="file" multiple className="hidden">` via a `ref`:

```tsx
<Button onClick={() => inputRef.current?.click()}>Browse files</Button>
<input ref={inputRef} type="file" multiple accept=".pdf,.docx" className="hidden" onChange={...} />
```

This is the standard way to get a custom-styled "upload" button while still using the browser's real native file picker (which you can't restyle directly) — both the drop handler and the file input's `onChange` funnel into the same `handleFiles`, so there's exactly one upload code path regardless of how the files arrived. While `onUpload` is in flight, the dropzone swaps its contents for a `Progress` bar driven by the `onProgress` callback threaded all the way from `uploadBatch`'s `onUploadProgress` (§1).

## 4. `EntryRow` — decision-driven rendering, with a direct service import

Most components in this app receive data and callbacks as props and never import a service directly. `EntryRow` breaks that pattern in exactly one place — the download button calls `cvScreeningsApi.downloadFile(entry.id, entry.filename)` straight from an `onClick`, rather than the parent (`CvScreeningDetailPage`) passing down an `onDownload` prop. The reasoning: a file download has no state the parent page needs to know about or react to (unlike invite/reject, which change the entry's `decision` and have to bubble back up to refresh the summary counts) — it's a pure side effect local to this one row, so threading a callback through props for it would be pure ceremony.

The rest of the row switches on `entry.decision` to pick a status pill's color/label, and only renders the `Invite`/`Reject` buttons when `decision === "needs_review"` — every other decision is either not-yet-resolved (`pending`, no action available yet) or already final (`invited`/`not_advanced`, already acted on, automatically or otherwise).

**Test file note:** `EntryRow.test.tsx` uses `fireEvent` from `@testing-library/react`, not the more commonly-recommended `@testing-library/user-event`. That's not a stylistic choice — `user-event` isn't an installed dependency in this project (checked `package.json` before writing the test rather than assuming it), and `fireEvent` covers everything these 4 tests need (rendering the right pill per decision, clicking Invite/Reject and asserting the callback fires with the right args).

## 5. `CvScreeningDetailPage` — the page that ties it together

The largest new file, and the one place several previously-separate pieces meet:

- **Two independent load effects, not one combined one** — screening + batches ("meta") load together in one effect, entries load in a separate effect:
  ```tsx
  const loadScreening = useCallback(async () => { ... }, [id]);
  const loadBatches = useCallback(async () => { ... }, [id]);
  const loadEntries = useCallback(async () => { ... }, [id, decisionFilter]);

  useEffect(() => {
    Promise.all([loadScreening(), loadBatches()])
      .catch(() => setError(true))
      .finally(() => setMetaLoadedId(id));
  }, [loadScreening, loadBatches, id]);

  useEffect(() => {
    loadEntries()
      .catch(() => setError(true))
      .finally(() => setEntriesLoadedId(id));
  }, [loadEntries, id]);
  ```
  The split matters because `loadEntries` depends on `decisionFilter` (so its identity — and therefore this `useCallback`'s reference — changes every time the filter tab bar is clicked) while `loadScreening`/`loadBatches` only depend on `id`. Putting all three in one effect with an honest dependency array would mean **every filter click re-fetches the screening and batches too**, and would need to re-run the loading skeleton to stay correct. Splitting them means the meta effect only ever re-fires when `id` itself changes (navigating to a different screening), while the entries effect fires both on mount and on every filter change — which is exactly the two different things that should trigger each fetch. This is a plain `react-hooks/exhaustive-deps`-compliant dependency array on both effects — no suppression comment, no ref-based "skip the first render" workaround. (An earlier draft of this page used a single combined effect with a suppressed lint rule plus a second `useRef`-guarded effect to fake the same behavior; that version made React Compiler refuse to memoize the component at all, since the compiler bails out on any component containing a suppressed hooks-lint rule. This split is both simpler and compiler-friendly.)
- **Loading state tracks *what's been loaded for the current `id`*, not a single boolean:**
  ```tsx
  const [metaLoadedId, setMetaLoadedId] = useState<string | undefined>(undefined);
  const [entriesLoadedId, setEntriesLoadedId] = useState<string | undefined>(undefined);
  const loading = metaLoadedId !== id || entriesLoadedId !== id;
  ```
  On mount (or navigating to a different screening), both trackers still hold the *previous* `id` (or `undefined`), so `loading` is `true` and the full-page skeleton shows until both effects above finish. On a filter-tab click, `id` doesn't change, so `metaLoadedId` is already `=== id` — `loading` stays `false` the whole time, and only the entries list updates, with no skeleton flash.
- **Polling only while something's still processing:**
  ```tsx
  const hasPendingEntries = entries.some((e) => e.decision === "pending");
  usePolling(async () => { await Promise.all([loadEntries(), loadScreening(), loadBatches()]); }, 5000, hasPendingEntries);
  ```
  `usePolling` (`src/hooks/usePolling.ts`, an existing hook from before this phase — not new) is a thin wrapper around `setInterval` gated by an `active` boolean. Reusing it here rather than always polling means a screening with nothing in flight doesn't keep hitting the API every 5 seconds forever — polling turns itself off the moment every entry has a final decision, and back on the moment a new batch is uploaded (since fresh entries start at `pending`).
- **The FR5 held-banner and the approximate-version notice** are both simple conditional renders off fields Phase 8's backend additions exposed directly (`latestBatch.notification_status === "held"` and `latestBatch.vacancy_version_approximate`) — no new frontend logic, just displaying what the backend already computed.

## 6. A gap this phase found by actually clicking through the UI, not by reading code

`CvScreeningNewPage` blocks creating a screening for a vacancy with no `public_requirement_text` (Phase 6's public gate has nothing to check candidates against otherwise) and shows a message pointing the recruiter at "Edit vacancy" to fix it. But neither `VacancyNewPage` nor `VacancyEditPage` actually had a form field for `public_requirement_text` — the type and the backend's `vacancy_params` supported it, but the form UI itself was never built. This was invisible from reading the code in isolation (the field "existed" end-to-end except for one missing `<Textarea>`) and only surfaced by literally clicking the message's own link and finding nowhere to type the fix. Both vacancy forms now have it — a `Textarea` with a 5000-character cap and a live counter, registered through react-hook-form the same way every other field on those forms already was.

## Running it yourself

```bash
cd web
npm run typecheck
npm test
npm run build
```

To see it live: `npm run dev`, sign in, go to **CV Screening** in the nav, create a screening against a vacancy that has `public_requirement_text` set, and drag a PDF onto the dropzone.
