# Phase 12 — Frontend changes, explained

Frontend only — no backend change was needed. Worth stating explicitly why: the existing
`GET /cv_screening_entries/:id/file` endpoint sends `disposition: 'attachment'`
(`cv_screening_entries_controller.rb#file`), which normally forces a browser download on direct
navigation to a URL. But this feature never navigates to that URL directly — it fetches the file
through the authenticated `axios` instance (same as the existing Download button already did) and
hands the browser a `blob:` URL constructed client-side. A browser only consults
`Content-Disposition` when it requests a URL itself; it has no way to see that header on a blob it
never round-tripped through the server for. So the header is simply irrelevant to this flow, and
the backend needed no change at all.

**Note on how this evolved:** the first version of this phase opened the CV in an in-app `Dialog`
with an `<iframe>`, plus a separate "full screen" button to escape into a new tab. A follow-up
request simplified that away — clicking Preview now opens the new tab directly, no modal step in
between. A second follow-up (UI cleanup pass on the whole candidates row) then removed the
Download button entirely, since Preview already covers viewing the file — `downloadFile` itself
was deleted from `cvScreeningsApi` at that point too, being fully unused once its only call site
was gone. This doc describes the current shape only.

## `fetchFileBlob` — the shared auth-fetch helper

Fetching an authenticated binary file (`GET /cv_screening_entries/:id/file`, same Bearer auth as
every other request) needs to go through the app's own `axios` instance rather than a plain
`<a href>`/`window.open`, since those don't carry the auth header:

```ts
fetchFileBlob: async (entryId: number) => {
  const res = await api.get(`/cv_screening_entries/${entryId}/file`, {
    responseType: "blob",
  });
  return new Blob([res.data as BlobPart], { type: "application/pdf" });
},
```

The explicit `{ type: "application/pdf" }` matters. Axios's `responseType: "blob"` already returns
a `Blob` with the correct type read from the response's own `Content-Type` header — but simply
re-wrapping it as `new Blob([res.data])` with no type argument (as an earlier version of this
helper, and the download flow it replaced, both did) silently drops that type information. A
browser tab navigated to a `blob:` URL decides whether to render a PDF inline or just download it
based on the blob's MIME type, so this matters directly for Preview.

## `EntryRow` — Preview opens a tab, it doesn't manage one

The Preview button sits before the existing Download button (an eye icon, same ghost-button
style). Its handler:

```tsx
const openPreview = async () => {
  const newTab = window.open("", "_blank");
  setPreviewLoading(true);
  try {
    const blob = await cvScreeningsApi.fetchFileBlob(entry.id);
    if (newTab) newTab.location.href = URL.createObjectURL(blob);
    setPreviewLoading(false);
  } catch {
    newTab?.close();
    setPreviewLoading(false);
  }
};
```

The tricky part is *when* `window.open` gets called. Browsers only allow a script to open a new
tab without triggering their popup blocker when the call happens synchronously inside a real user
gesture (a click handler) — not after an `await`. Fetching the file is necessarily async, so
`window.open` can't wait for the blob first; it opens a blank tab (`window.open("", "_blank")`)
*immediately*, still inside the click, then once the fetch resolves, navigates that already-open
tab to the blob URL by setting `newTab.location.href`. If the fetch fails, the blank tab gets
closed again (`newTab?.close()`) rather than left sitting open and empty.

Note the duplicated `setPreviewLoading(false)` in both branches rather than a single
`try/finally` — this follows the same rule Phase 13's `handleReanalyze`/`handleCancel` already
established (see [`phase-13-frontend.md`](./phase-13-frontend.md)): this app's React Compiler
setup doesn't play well with that shape, so every async handler in this codebase resets its own
loading state explicitly in both the success and catch paths.

## No cleanup needed for the blob URL

Unlike a download (where the blob URL is only needed for the instant it takes to trigger `<a
download>`, then immediately revoked), a preview tab needs the URL to stay valid for as long as
the recruiter is reading the CV — there's no reliable moment to call `URL.revokeObjectURL` from
this app's side once the tab is opened, since it doesn't control when that separate tab closes.
The URL stays valid for the lifetime of the app tab that created it (same-origin blob URLs aren't
tied to the specific window that opened them), so the trade-off is a small amount of retained
memory per preview, for the length of the recruiter's session — bounded and low-volume enough not
to be worth chasing further.

## Specs

`EntryRow.test.tsx` mocks `cvScreeningsApi.fetchFileBlob`, `window.open` (returning a fake window
object with a settable `location.href`), and `URL.createObjectURL` (jsdom doesn't implement it),
then clicks Preview and asserts, in order: a blank tab was opened synchronously
(`window.open("", "_blank")`), the fetch fired for the right entry id, and the fake tab's
`location.href` was ultimately set to the blob URL.

## Running it yourself

```bash
cd web
npm run typecheck
npm test
npm run build
```
