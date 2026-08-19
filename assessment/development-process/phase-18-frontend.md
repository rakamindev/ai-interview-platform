# Phase 18 — Frontend changes, explained

A new page, but not a new pattern — this is two already-established shapes from earlier phases
combined, not a fresh design. For the backend reasoning (why almost nothing needed to change
there, and why that isn't a coincidence), see [`phase-18-backend.md`](./phase-18-backend.md).

## Same fields as create, shaped like an edit page

`CvScreeningEditPage.tsx`'s form — the name `Input`, the vacancy/assessment `Select`s, the
threshold `Input`, even the "this vacancy has no public requirement text" warning linking to
`/vacancies/:id/edit` — is the same JSX as `CvScreeningNewPage.tsx`'s, copied rather than shared
via a common component (matching how `VacancyEditPage`/`VacancyNewPage` and
`AssessmentEditPage`/`AssessmentNewPage` already relate in this codebase — this project doesn't
factor create/edit forms into one shared component elsewhere, so this doesn't introduce a new
inconsistency by not doing so either).

What actually differs is the *lifecycle* around that form, and that shape comes from
`VacancyEditPage.tsx` instead:

```tsx
useEffect(() => {
  Promise.all([cvScreeningsApi.get(Number(id)), vacanciesApi.list(), assessmentsApi.list()])
    .then(([sRes, vRes, aRes]) => {
      setVacancies(vRes.data.vacancies);
      setAssessments(aRes.data.assessments);
      const s = sRes.data.cv_screening;
      reset({
        name: s.name,
        vacancy_id: String(s.vacancy_id),
        assessment_id: String(s.assessment_id),
        threshold: s.threshold != null ? String(s.threshold) : "",
      });
    })
    .catch(() => setLoadError(true))
    .finally(() => setLoading(false));
}, [id, reset]);
```

One combined load instead of the create page's fetch-only-the-picker-lists effect, and
`reset()` (react-hook-form) instead of just setting default values — the same technique
`VacancyEditPage` already uses to pre-fill a form from a fetched record. `onSubmit` calls
`cvScreeningsApi.update(id, ...)` instead of `create`.

## Where it navigates back to — and why that's not arbitrary

```tsx
navigate(`/cv-screenings/${id}`);
```

Checked both existing edit pages before picking this: `AssessmentEditPage.tsx` navigates to
`/assessments/${id}/invite` (the assessment's own detail page) on save *and* Cancel, while
`VacancyEditPage.tsx` navigates to `/vacancies` (the list). These aren't inconsistent with each
other — `Assessment` has a separate detail page (`AssessmentInvitePage`), `Vacancy` doesn't (its
edit page *is* its only page beyond the list). `CvScreening` has a separate detail page too
(`CvScreeningDetailPage`), so it follows `Assessment`'s precedent, not `Vacancy`'s.

## Wiring

`App.tsx` gains one route, `/cv-screenings/:id/edit`, next to the existing `/cv-screenings/:id`.
`CvScreeningDetailPage.tsx`'s header gains an "Edit" button before the existing Delete button
(`Pencil` icon, `variant="outline"`), matching the Edit-then-Delete order already established on
`AssessmentInvitePage.tsx`.

## What live-testing this actually confirmed, not just exercised

Opening Edit showed all four fields correctly pre-filled from the real record (not just blank
defaults). Changing the threshold and saving redirected back to the detail page as expected — but
the detail page's own auto-invite threshold banner (built in an earlier phase) kept showing the
*old* value, not the one just saved. That's not a bug: that banner reads
`latestBatch?.threshold ?? screening?.threshold` on purpose, and this screening already has an
uploaded batch with 18 candidates — the banner is supposed to show what actually governed those
candidates' real decisions, not the screening's live setting. Re-opening Edit confirmed the new
value *did* persist to the screening record correctly; it just doesn't retroactively change what
the banner reports about already-decided candidates. This is the snapshot-immutability behavior
from earlier phases working exactly as designed, caught by actually looking at the running app
rather than only checking that the save request returned 200.

## Specs

No new frontend test file — matches the precedent already set by every other page this deletion/
edit work has touched (`VacancyEditPage`, `AssessmentInvitePage`, `CvScreeningDetailPage`): none of
them have a test file, and no prior phase touching any of them has added one. Verified live in the
browser instead, per the note above.

## Running it yourself

```bash
cd web
npm run typecheck
npm test
npm run build
```
