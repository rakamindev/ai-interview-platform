## 1. Backend — list includes skills

- [x] 1.1 In `VacanciesController#index`, eager-load skills with `Vacancy.includes(:vacancy_skills)` and emit a lightweight `skills` array (`id`, `skill_id`, `skill_label`, `expected_level`) per vacancy; do not load `SkillTaxonomy` anchors for the list
- [ ] 1.2 Add/extend the vacancies request spec: `index` returns `skills` per vacancy, and assert no N+1 (query-count around a multi-vacancy list) — **Deferred** (see "Deferred follow-up" below): no RSpec harness or Ruby toolchain is available in this environment to author/run it

## 2. Frontend — resilient rendering + type

- [x] 2.1 Make `Vacancy.skills` optional (`skills?: VacancySkill[]`) in `web/src/types/index.ts`
- [x] 2.2 Guard skills usage in `VacancyListPage.tsx`: render via `(v.skills ?? [])` and filter via `v.skills?.some(...)`, so an absent/empty skills list shows "No skills configured" without throwing
- [x] 2.3 Audit other `Vacancy.skills` consumers surfaced by the optional type (e.g., `VacancyEditPage` `reset({ skills: v.skills })`) and guard with `?? []`

## 3. Tests — resilience + contract alignment

- [x] 3.1 Update `VacancyListPage.test.tsx` fixtures to reflect the real list shape and add a resilience test: a vacancy with absent/empty skills renders "No skills configured" and no error state
- [x] 3.2 Run `vp check` and `vp test` (web) to green — 465 tests pass; coverage 97.06% stmts / 90.15% branch / 95.83% funcs / 98.69% lines. (Backend request-spec verification is deferred with task 1.2.)

## Deferred follow-up

- **Backend vacancies request spec (task 1.2).** Deferred to an environment with Ruby + a test database. The backend has no RSpec scaffolding yet (`spec/rails_helper.rb`, factories for `Vacancy`/`VacancySkill`, and auth-token/tenant setup for `authorize_auth_token! :assessor`), and this environment has no Ruby/bundler — so the spec cannot be authored against a real harness or run here. The `index` controller change (task 1.1) is implemented but unverified for the same reason. When picking this up: scaffold RSpec, add factories + an assessor auth-token helper, then assert the list response includes `skills` per vacancy and issues no per-vacancy skill query (query-count around ≥2 vacancies).
