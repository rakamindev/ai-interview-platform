# Assessor Workspace UI Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the assessor workspace with server-backed list pagination/filtering, responsive assessment/vacancy modal forms, report-quality monitoring/transcript pages, Sonner request errors, and complete form placeholders.

**Architecture:** Keep the existing Rails API and React/Vite app. Add additive `search`, `status`, and `page` list parameters; create focused React primitives for toasts, pagination, list toolbars, and form dialogs; migrate assessment/vacancy list actions to controlled dialogs while keeping invite/report routes unchanged. Preserve field-level validation and all current authorization/report behavior.

**Tech Stack:** Rails 7 API, React 18, Vite, TypeScript, Tailwind v3, Radix/shadcn-style primitives, React Hook Form, Zod, Vitest/Testing Library, Sidekiq unchanged.

## Global Constraints

- Preserve existing Rakamin teal/yellow color tokens and the committed editorial visual system.
- Preserve API authorization, portfolio, fit/gap, override, polling, and export behavior.
- Field validation remains inline with `aria-invalid` and `aria-describedby`.
- Sonner is for request/system errors; never replace field validation with a toast.
- Hide the desktop profile/avatar dropdown on mobile; keep one mobile navigation control.
- Use server-backed pagination/filtering; never pretend a single page is the complete dataset.
- Keep modal values on save failure and close only after a successful save.

---

### Task 1: Define testing plan and shared async/error conventions

**Files:**
- Create: `docs/features/assessor-workspace-ui/testing-plan.md`
- Modify: `web/package.json`
- Modify: `web/src/main.tsx`
- Create: `web/src/lib/requestToast.ts`
- Create: `web/src/components/ui/toaster.tsx`

**Interfaces:**
- `showRequestError(error: unknown, fallback: string): void` uses `apiErrorMessage` and calls `toast.error`.
- Root mounts exactly one `Toaster`.

- [ ] **Step 1: Write the testing plan before touching test files**

Document requirement-to-test mapping for pagination/filter query transitions, modal success/failure persistence, Sonner invocation, placeholders, mobile header controls, live monitor/transcript states, and tenant-scoped API filters. List existing Vitest conventions, browser/manual checks, commands, and known gaps.

- [ ] **Step 2: Install Sonner without changing the existing palette**

Run from `web`:

```bash
npm install sonner
```

The dependency install updates `web/package-lock.json`; include that lockfile in the foundation commit.

- [ ] **Step 3: Add the request toast helper**

Implement:

```ts
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/httpError";

export function showRequestError(error: unknown, fallback: string) {
  toast.error(apiErrorMessage(error, fallback));
}
```

- [ ] **Step 4: Mount the root toaster**

Render `<Toaster position="top-right" richColors={false} closeButton />` next to `App` inside `ErrorBoundary`, preserving the current Jotai and router providers.

- [ ] **Step 5: Run the focused typecheck**

Run `npm run typecheck` from `web`. Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add docs/features/assessor-workspace-ui/testing-plan.md web/package.json web/package-lock.json web/src/main.tsx web/src/lib/requestToast.ts web/src/components/ui/toaster.tsx
git commit -m "feat: add assessor request toast foundation"
```

---

### Task 2: Add shared pagination, list toolbar, metrics, and responsive dialog primitives

**Files:**
- Create: `web/src/components/workspace/PaginationControls.tsx`
- Create: `web/src/components/workspace/ListToolbar.tsx`
- Create: `web/src/components/workspace/MetricStrip.tsx`
- Create: `web/src/components/workspace/FormDialog.tsx` if the current Dialog primitive needs a feature wrapper
- Modify: `web/src/components/ui/dialog.tsx` only for responsive sizing/focus-safe classes
- Modify: `web/src/types/index.ts` only if query/filter result types need explicit additions

**Interfaces:**

```ts
<PaginationControls meta={PaginationMeta} onPageChange={(page: number) => void} />
<ListToolbar search={string} onSearchChange={(value: string) => void} filters={...} resultCount={number} />
<MetricStrip items={{ label: string; value: number; tone?: string; icon?: LucideIcon }[]} />
```

- [ ] **Step 1: Add component tests to the testing plan’s target files**

Cover previous/next disabled state, current-page accessibility, search clear action, filter change callback, and metric rendering. Use Testing Library user interactions, not class-name assertions.

- [ ] **Step 2: Implement pagination controls**

Render current page, total pages, result count, Previous/Next buttons, and compact page buttons for nearby pages. Set `aria-current="page"` on the current button and disable navigation at boundaries.

- [ ] **Step 3: Implement the list toolbar**

Use an accessible search input with a meaningful placeholder, clear button, optional select filters, and a live result-count region. Keep toolbar controls responsive without horizontal overflow.

- [ ] **Step 4: Implement the metric strip**

Use the current primary/secondary tokens with low-opacity surfaces and stable card dimensions matching the portfolio report.

- [ ] **Step 5: Make Dialog responsive**

Use full-width content with safe viewport height, internal scrolling, sticky footer support, and 44px close/control targets. Do not alter existing override modal behavior beyond shared sizing.

- [ ] **Step 6: Run focused shared component tests and typecheck**

Run the new workspace component test files and `npm run typecheck` from `web`. Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/workspace web/src/components/ui/dialog.tsx web/src/types/index.ts web/src/components/workspace/*.test.tsx
git commit -m "feat: add assessor workspace UI primitives"
```

---

### Task 3: Add server-backed assessment and vacancy search/filter parameters

**Files:**
- Modify: `api/app/controllers/api/v1/assessments_controller.rb`
- Modify: `api/app/controllers/api/v1/vacancies_controller.rb`
- Modify: `web/src/services/assessments.ts`
- Modify: `web/src/services/vacancies.ts`
- Test: `api/spec/requests/api/v1/assessments_spec.rb` or the closest existing assessment request spec
- Test: `api/spec/requests/api/v1/vacancies_spec.rb` or the closest existing vacancy request spec

**Interfaces:**

```ts
type AssessmentListParams = { page?: number; search?: string; status?: "all" | "live" | "completed" | "awaiting" };
type VacancyListParams = { page?: number; search?: string };
assessmentsApi.list(params?: AssessmentListParams)
vacanciesApi.list(params?: VacancyListParams)
```

- [ ] **Step 1: Add request specs for tenant-scoped search/filter behavior**

Cover name/role search, assessment status filters, pagination metadata, empty results, and foreign-tenant records excluded. Assert response shape and count, not SQL implementation.

- [ ] **Step 2: Implement assessment query composition**

Normalize blank search/status to no filter. Search only the tenant-scoped assessment relation by name. Derive status from the latest session using the existing status semantics; preserve newest-first ordering and existing `pagination_meta`.

- [ ] **Step 3: Implement vacancy search**

Search tenant-scoped vacancies by role title, preserve newest-first ordering and existing pagination envelope.

- [ ] **Step 4: Pass additive params from web services**

Keep no-argument callers valid by defaulting to `{ page: 1 }`; omit empty search and `all` status values.

- [ ] **Step 5: Run focused API specs**

Run the two request spec files with `rbenv exec bundle exec rspec`. Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add api/app/controllers/api/v1/assessments_controller.rb api/app/controllers/api/v1/vacancies_controller.rb api/spec/requests/api/v1 web/src/services/assessments.ts web/src/services/vacancies.ts
git commit -m "feat: add tenant-scoped list search and filters"
```

---

### Task 4: Convert assessment new/edit forms into one controlled dialog

**Files:**
- Create: `web/src/components/assessment/AssessmentFormDialog.tsx`
- Modify: `web/src/pages/assessments/AssessmentListPage.tsx`
- Modify: `web/src/App.tsx`
- Delete or replace: `web/src/pages/assessments/AssessmentNewPage.tsx`
- Delete or replace: `web/src/pages/assessments/AssessmentEditPage.tsx`
- Modify: `web/src/components/assessment/CustomSkillForm.tsx`
- Test: `web/src/components/assessment/AssessmentFormDialog.test.tsx`
- Modify: assessment list tests and existing assessment form tests only after the testing plan exists

**Interfaces:**

```ts
interface AssessmentFormDialogProps {
  mode: "create" | "edit";
  assessmentId?: number;
  open: boolean;
  onOpenChange(open: boolean): void;
  onSaved(assessment: Assessment): void;
}
```

- [ ] **Step 1: Add tests for create/edit loading, validation, save success, save failure, and value persistence**

Use mocked `assessmentsApi` and `SkillPicker`; assert modal title, required field validation, save calls, close-after-success, open-after-failure, and preserved field values.

- [ ] **Step 2: Extract shared form state from the existing new/edit pages**

Reuse `AssessmentFormValues`, Zod normalization, `useFieldArray`, drag/drop sensors, taxonomy picker, and legacy-null handling. Do not duplicate request payload construction.

- [ ] **Step 3: Implement responsive dialog form**

Add placeholders to every input/textarea/select-like control. Keep inline errors and sticky dialog footer. Use Sonner for API failure while retaining entered values.

- [ ] **Step 4: Wire list actions**

`New Assessment` opens create mode; each card’s edit action opens edit mode; successful save refreshes current page and closes the dialog.

- [ ] **Step 5: Redirect stale form routes**

Replace old route elements with `<Navigate to="/assessments" replace />`; remove normal navigation to dedicated forms. Keep invite route unchanged.

- [ ] **Step 6: Run focused assessment dialog/list tests and typecheck**

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/assessment/AssessmentFormDialog.tsx web/src/pages/assessments web/src/components/assessment/CustomSkillForm.tsx web/src/App.tsx
 git commit -m "feat: move assessment editing into dialog"
```

---

### Task 5: Convert vacancy new/edit forms into one controlled dialog

**Files:**
- Create: `web/src/components/vacancy/VacancyFormDialog.tsx`
- Modify: `web/src/pages/vacancies/VacancyListPage.tsx`
- Modify: `web/src/App.tsx`
- Delete or replace: `web/src/pages/vacancies/VacancyNewPage.tsx`
- Delete or replace: `web/src/pages/vacancies/VacancyEditPage.tsx`
- Test: `web/src/components/vacancy/VacancyFormDialog.test.tsx`
- Modify: vacancy list tests after the testing plan exists

**Interfaces:**

```ts
interface VacancyFormDialogProps {
  mode: "create" | "edit";
  vacancyId?: number;
  open: boolean;
  onOpenChange(open: boolean): void;
  onSaved(vacancy: Vacancy): void;
}
```

- [ ] **Step 1: Add tests for loading, validation, save success, save failure, and preserved values**

Mock `vacanciesApi` and `SkillPicker`; assert expected level selection, skill removal, placeholders, dialog close behavior, and error toast path.

- [ ] **Step 2: Extract the shared vacancy form**

Reuse `vacancySchema`, `useFieldArray`, taxonomy picker, expected-level controls, and current payload shape for create/update.

- [ ] **Step 3: Implement the responsive dialog**

Use a scrollable content region and sticky footer. Add placeholders to role title, culture, competency, and skill controls. Keep field errors inline.

- [ ] **Step 4: Wire vacancy list actions and stale route redirects**

New vacancy and edit vacancy open the dialog; success refreshes current page and closes; old routes redirect to `/vacancies`.

- [ ] **Step 5: Run focused vacancy tests and typecheck**

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/vacancy/VacancyFormDialog.tsx web/src/pages/vacancies web/src/App.tsx
 git commit -m "feat: move vacancy editing into dialog"
```

---

### Task 6: Redesign assessment and vacancy list pages

**Files:**
- Modify: `web/src/pages/assessments/AssessmentListPage.tsx`
- Modify: `web/src/pages/vacancies/VacancyListPage.tsx`
- Modify: associated list tests

**Interfaces:**

- Each page owns `page`, `search`, `status` (assessment only), `loading`, `error`, and `meta` state.
- Changing search/status sets page to 1 and refetches; changing page refetches with current filters.

- [ ] **Step 1: Add list tests for query transitions and empty/filter states**

Assert API params on initial load, search, status, clear filters, next page, and no-match empty state. Assert request errors call the toast helper and expose retry.

- [ ] **Step 2: Implement assessment page layout**

Use report-style header, metric strip, toolbar, cards with session status, language/time metadata, edit action, and pagination controls.

- [ ] **Step 3: Implement vacancy page layout**

Use the same hierarchy, search toolbar, skill/culture metadata, edit action, empty state, and pagination controls.

- [ ] **Step 4: Add Sonner request errors and retry surfaces**

Do not leave full-width inline system-error labels as the only feedback.

- [ ] **Step 5: Run page tests and typecheck**

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/assessments/AssessmentListPage.tsx web/src/pages/vacancies/VacancyListPage.tsx web/src/pages/assessments/*.test.tsx web/src/pages/vacancies/*.test.tsx
 git commit -m "feat: add paginated assessor lists"
```

---

### Task 7: Upgrade live monitoring and transcript pages

**Files:**
- Modify: `web/src/pages/monitor/LiveMonitorPage.tsx`
- Modify: `web/src/pages/transcript/TranscriptPage.tsx`
- Test: existing monitor/transcript tests and new focused tests after the testing plan exists

**Interfaces:**

- Live monitor keeps existing WebSocket/polling/session-end APIs.
- Transcript keeps `sessionsApi.getTranscript` and adds client-side `search` and `speaker` filters over loaded turns.

- [ ] **Step 1: Add tests for monitor connection/recovery/end states and transcript filters**

Cover loading, no turns, live/ended/reconnecting states, end-session failure toast, text filtering, speaker filtering, and download visibility.

- [ ] **Step 2: Implement live monitor report shell**

Use wide max-width, status hero, metric strip, coverage cards, discovered section, transcript log panel, and one recoverable status surface. Use Sonner for request errors.

- [ ] **Step 3: Implement transcript report shell**

Add search/speaker controls, stable timeline rows, download action, and responsive empty/error states.

- [ ] **Step 4: Run focused monitor/transcript tests and browser smoke**

Expected: pass at 390px and 1108px.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/monitor/LiveMonitorPage.tsx web/src/pages/transcript/TranscriptPage.tsx web/src/pages/monitor/*.test.tsx web/src/pages/transcript/*.test.tsx
 git commit -m "feat: redesign live monitor and transcript review"
```

---

### Task 8: Apply shared error/placeholders polish to remaining pages and reports

**Files:**
- Modify: `web/src/pages/fitgap/FitGapReportPage.tsx`
- Modify: `web/src/pages/portfolio/PortfolioPage.tsx`
- Modify: `web/src/pages/auth/LoginPage.tsx`
- Modify: `web/src/pages/auth/SignupPage.tsx`
- Modify: `web/src/components/assessment/CustomSkillForm.tsx`
- Modify: `web/src/components/assessment/SkillCard.tsx`
- Create: `web/src/pages/auth/LoginPage.test.tsx` and `web/src/pages/auth/SignupPage.test.tsx`

**Interfaces:**

- No API contract changes.
- Request failures call `showRequestError`; field validation remains local.

- [ ] **Step 1: Inventory every input, textarea, and select in `FitGapReportPage.tsx`, `PortfolioPage.tsx`, `LoginPage.tsx`, `SignupPage.tsx`, `CustomSkillForm.tsx`, and `SkillCard.tsx`**

Ensure every user-editable control has a meaningful placeholder; select/radio controls use visible labels and accessible names instead of placeholder text.

- [ ] **Step 2: Replace request-error labels with Sonner plus recovery controls**

Keep inline state only when the user must act in that surface (retry, failed generation, or load error).

- [ ] **Step 3: Preserve portfolio/fit-gap visual behavior**

Do not alter comparison calculation, polling guards, override persistence, or exports.

- [ ] **Step 4: Run focused report/auth/form tests and typecheck**

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages web/src/components/assessment
 git commit -m "refactor: standardize assessor errors and form guidance"
```

---

### Task 9: Full verification and browser acceptance

**Files:**
- Modify: `docs/features/assessor-workspace-ui/testing-plan.md` with final results and known gaps.

- [ ] **Step 1: Run API focused and full regression**

```bash
cd api
rbenv exec bundle exec rspec spec/requests/api/v1/assessments_spec.rb spec/requests/api/v1/vacancies_spec.rb
rbenv exec bundle exec rspec
```

Expected: all examples pass; existing Rails/DB warnings may remain non-fatal.

- [ ] **Step 2: Run web verification**

```bash
cd web
npm run typecheck
npm test -- --run
npm run build
```

Expected: typecheck, all Vitest files, and build pass.

- [ ] **Step 3: Browser verify desktop**

At 1108px or wider verify assessment list, vacancy list, assessment modal, vacancy modal, live monitor, transcript, portfolio, fit/gap, tenant visibility, and profile dropdown.

- [ ] **Step 4: Browser verify mobile**

At 390px verify one header nav control, no horizontal overflow, internal modal scrolling, filter controls, pagination, monitor transcript, and report cards.

- [ ] **Step 5: Record final test results and commit**

```bash
git add docs/features/assessor-workspace-ui/testing-plan.md
git commit -m "test: verify assessor workspace UI enhancement"
```
