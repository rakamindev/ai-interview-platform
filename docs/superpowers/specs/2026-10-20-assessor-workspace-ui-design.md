# Assessor Workspace UI Enhancement

## Status

Approved by the user for implementation.

## Goal

Bring the assessor workspace pages to the committed Rakamin editorial teal quality bar while adding server-backed list pagination/filtering, responsive assessment/vacancy modal forms, clearer live monitoring/transcript states, Sonner system-error feedback, and complete field placeholders.

## Existing constraints

- Preserve the existing Rakamin color tokens and the visual language from `f12208f`.
- Preserve API authorization, portfolio, fit/gap, override, polling, and export behavior.
- Existing field-level validation remains inline and associated with its field.
- Sonner is for request/system failures, not a replacement for field validation.
- Mobile header has one navigation control: hide the desktop profile/avatar dropdown on mobile; keep the mobile navigation control.
- Assessment and vacancy add/edit forms become modal flows. Invite remains a dedicated page.
- Portfolio has no add/edit route; portfolio review and override remain on the portfolio/report surfaces.
- No client-only fake pagination. List pagination/filter parameters are additive API behavior.

## Shared system

### Toasts

Add `sonner` and mount one `Toaster` at the application root with the existing light theme and Rakamin tokens. Add a small `showRequestError(error, fallback)` helper that uses `apiErrorMessage`. Request failures toast once per user action; pages retain a local retry/empty state where recovery requires it.

### Pagination and filters

Add reusable `PaginationControls` consuming `PaginationMeta` and an `onPageChange(page)` callback. Add reusable list toolbar conventions: search input with a clear button, filter select, result count, and a compact loading state.

Assessment list:

- server params: `page`, `search`, `status`;
- search by assessment name;
- status filter: `all`, `live`, `completed`, `awaiting`;
- preserve current page when only rendering changes; reset to page 1 when search/filter changes.

Vacancy list:

- server params: `page`, `search`;
- search by role title;
- reset to page 1 when search changes.

Rails list endpoints must scope all filtering to the current tenant and return the existing `{ items, meta }` envelope. `meta` remains `PaginationMeta`.

### Modal forms

Use controlled Radix Dialog with a responsive full-screen-on-small viewport layout and a sticky dialog footer. Reuse existing form code patterns and field arrays rather than creating duplicate validation rules.

- `AssessmentFormDialog`: add/edit mode, role title, time limit, language, sortable skills, taxonomy picker, custom skill fields, placeholders, inline validation.
- `VacancyFormDialog`: add/edit mode, role title, expected skills, culture dimensions, competency expectations, placeholders, inline validation.
- On successful save: close dialog, refresh the list, and show a success toast.
- On request failure: keep dialog open, preserve entered values, and show a Sonner error.
- Dedicated `/assessments/new`, `/assessments/:id/edit`, `/vacancies/new`, and `/vacancies/:id/edit` routes are removed from normal navigation after migration; stale direct URLs redirect to the list.

## Page designs

### Assessment list

- Editorial page header with title, count, and primary `New assessment` action.
- Summary metrics for total, live, completed, and awaiting candidate.
- Toolbar under the header.
- Assessment cards expose role name, time limit, language, latest session state, updated date, and actions.
- Card click opens the existing assessment invite/workspace route; edit action opens the dialog.
- Empty state includes clear filter state and create action.

### Vacancy list

- Same page/header/metric language as assessments.
- Vacancy cards expose role title, skill count, culture/competency availability, updated date, and edit action.
- Add/edit use the responsive dialog.
- Empty, loading, error, and pagination states match assessment list.

### Live monitor

- Wide report-style shell instead of a narrow document column.
- Header shows assessment/session identity, elapsed time, connection state, and end-session action.
- Coverage summary metrics precede configured/discovered coverage cards.
- Transcript is a dedicated live log panel with speaker styling and stable scroll behavior.
- Session ended, polling recovery, and end-session failure use a single status surface plus Sonner for the request error.

### Transcript

- Wide report-style shell with candidate/session metadata and download action.
- Search/filter controls for speaker and text are client-side over the loaded transcript.
- Timeline rows use the same speaker/evidence hierarchy as portfolio evidence.
- Empty and error states use the shared visual system; load failures toast and retain a retry surface.

### Fit/Gap and portfolio

Keep the committed design and behavior. Add only shared system adoption where it improves consistency: Sonner for export/request errors, shared metadata/status treatments, and responsive controls without changing report calculations.

## Error and loading rules

- Network/provider/system failures: Sonner plus a recoverable page state when necessary.
- Field validation: inline `aria-invalid`, `aria-describedby`, and message next to the field.
- Loading: skeletons shaped like the final content, not generic full-page blanks.
- Empty result after filters: explicit no-match state with `Clear filters`.
- Modal save failure: dialog remains open and values are not reset.

## Accessibility and responsive acceptance

- All icon-only buttons have accessible names and are at least 44px.
- Dialogs have title/description, restore focus, and support Escape.
- Pagination buttons expose current page and disabled states.
- Filter changes are announced through result count/status where applicable.
- At 390px: no horizontal page overflow; modal content scrolls internally; mobile header has only the nav control.
- At 1108px and above: tenant text is readable, profile dropdown is available, and list content uses the full report-style rail.

## Verification

- Web typecheck, full Vitest suite, and production build.
- Component tests for pagination/filter transitions, modal add/edit success/failure, toast invocation, placeholders, and mobile header controls.
- Browser verification for assessment list, vacancy list, assessment modal, vacancy modal, live monitor, transcript, portfolio, and fit/gap at mobile and desktop widths.
- API request specs for additive assessment/vacancy search/status params and tenant-scoped results.
