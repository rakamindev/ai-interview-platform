## Why

Admin/assessor users hit the global `ErrorBoundary` ("Something went wrong.") whenever they open `/vacancies` with at least one vacancy. Root cause is a frontend/backend contract mismatch: the list endpoint `GET /api/v1/vacancies` (`VacanciesController#index` → `vacancy_json`) omits each vacancy's `skills`, but `VacancyListPage` renders `v.skills.length` per row (`VacancyListPage.tsx:96`) and the `Vacancy` type declares `skills` as required (`types/index.ts:123`). `undefined.length` throws during render and bubbles to the `ErrorBoundary`. The single-vacancy endpoints (`show`/`create`/`update`) already return skills via `vacancy_with_skills_json`, so the shape is inconsistent across the same resource. This also violates the existing `vacancy-management` requirement that list rows show skills and support search-by-skill — impossible when the list omits skills. The unit test passes only because its mock hand-builds vacancies *with* skills, hiding the drift.

## What Changes

- **Backend (contract):** `VacanciesController#index` includes a lightweight `skills` array (id, skill_id, skill_label, expected_level) per vacancy, consistent with the single-vacancy endpoints. It eager-loads via `Vacancy.includes(:vacancy_skills)` to avoid N+1 and does **not** load taxonomy anchors (the list doesn't use them).
- **Frontend (resilience):** `VacancyListPage` treats skills as possibly-absent (`v.skills ?? []` in render and search), and `Vacancy.skills` becomes optional in the type, so any missing/partial/legacy response degrades to a "No skills configured" note instead of crashing the page.
- **Tests:** align the `VacancyListPage` fixtures with the real list shape, add a resilience test (a vacancy with absent/empty skills renders safely, no error page), and add/extend a backend request spec asserting the list includes skills without N+1.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `vacancy-management`: strengthen "Vacancy list with assessment-relevant summaries" to require resilient rendering when a vacancy's skills are absent/empty; add a requirement that the vacancy list API response includes each vacancy's skill summaries (consistent with the single-vacancy endpoints, without N+1).

## Impact

- **Code:** `api/app/controllers/api/v1/vacancies_controller.rb` (index: `.includes(:vacancy_skills)` + lightweight skills json); `web/src/pages/vacancies/VacancyListPage.tsx` (guard `v.skills`); `web/src/types/index.ts` (`skills?` optional); tests (`web/.../VacancyListPage.test.tsx` fixtures + resilience, backend vacancies request spec).
- **Behavior:** `/vacancies` renders skill chips and search-by-skill again; the ErrorBoundary crash is eliminated.
- **Risk:** making `Vacancy.skills` optional ripples to other consumers — audit `VacancyEditPage` (`reset({ skills: v.skills })`) and guard with `?? []`. Minor perf cost on index (now loads skills), mitigated by `.includes`. The same list-vs-show asymmetry may exist for other resources (e.g., assessments list) — noted as a follow-up, out of scope here.
