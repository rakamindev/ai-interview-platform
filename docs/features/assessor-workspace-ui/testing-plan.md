# Testing Plan

## Requirement Coverage

| Requirement | Test Type | Test Location | Expected Result |
| --- | --- | --- | --- |
| Request/system errors use Sonner | Component | `web/src/lib/requestToast.test.ts` | API error message is passed to `toast.error` |
| Pagination controls expose current/disabled states | Component | `web/src/components/workspace/PaginationControls.test.tsx` | Boundary buttons disable and current page is announced |
| List search/filter resets to page one | Component/page | Assessment and vacancy list tests | API receives page 1 with changed filters |
| Assessment/vacancy dialogs save and close | Component | `AssessmentFormDialog.test.tsx`, `VacancyFormDialog.test.tsx` | Successful save closes and refreshes |
| Dialog save errors preserve values | Component | Same dialog tests | Dialog remains open with entered values and toast error |
| Mobile header has one navigation control | Component/browser | `AssessorLayout.test.tsx`, manual browser check | Profile dropdown is hidden on mobile; nav control remains |
| Live monitor recovery/end states | Component/browser | `LiveMonitorPage.test.tsx`, manual browser check | Status states remain readable and errors are recoverable |
| Transcript search/speaker filters | Component | `TranscriptPage.test.tsx` | Filtered turns match query and speaker |
| Placeholders cover editable fields | Component/browser | Form tests and manual browser check | Inputs/textareas expose meaningful placeholders |
| Tenant-scoped list filters | API request | Assessment/vacancy request specs | Search/filter cannot expose another tenant's rows |

## API Tests

- Request specs for assessment `search`, `status`, and `page` parameters.
- Request specs for vacancy `search` and `page` parameters.
- Assert existing pagination envelope and tenant scoping.

## Web Tests

- Vitest/Testing Library follows existing repository conventions.
- Mock API services and Sonner; do not call real backend services.
- Cover loading, success, empty, no-match, error, and malformed response states where relevant.
- Manual browser checks at 390px and 1108px for lists, dialogs, monitor, transcript, portfolio, and fit/gap.
- Accessibility checks: labels, dialog title/description, `aria-current`, disabled pagination, icon button names, and keyboard dialog close.

## Security Checks

- Tenant filters remain server-side and are covered by API request tests.
- No user text is rendered as unsafe HTML.
- System error toast copy comes from sanitized API error helper output.

## Regression Tests

- Existing assessment/vacancy create/update payloads.
- Legacy-null assessment skill normalization.
- Existing portfolio override modal and save behavior.
- Fit/gap queue guard, polling, export, and comparison rendering.
- Existing live-monitor WebSocket/polling/session-end behavior.

## Commands

```bash
cd api
rbenv exec bundle exec rspec spec/requests/api/v1/assessments_spec.rb spec/requests/api/v1/vacancies_spec.rb
rbenv exec bundle exec rspec

cd ../web
npm run typecheck
npm test -- --run
npm run build
```

## Known Gaps

- No browser automation framework is currently configured; browser acceptance uses the existing local agent-browser workflow.
- Transcript filtering is client-side because the existing endpoint returns the loaded transcript; no new transcript search API is required.
