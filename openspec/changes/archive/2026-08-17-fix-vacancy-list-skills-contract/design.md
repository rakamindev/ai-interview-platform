## Context

Three facts pin the bug down:

1. `VacanciesController#index` maps each row through `vacancy_json` (id, role_title, culture_dimensions, competency_expectations, created_by, timestamps) — **no `skills`**. `show`/`create`/`update` use `vacancy_with_skills_json`, which includes `skills`.
2. `VacancyListPage` assumes `skills` is always an array: `v.skills.length` in the row render (`:96`) and `v.skills.some(...)` in the search filter (`:33`). The `Vacancy` type declares `skills: VacancySkill[]` (required).
3. On a non-empty list, `v.skills` is `undefined` → `undefined.length` throws during render → `ErrorBoundary` → "Something went wrong." An empty list renders the "No vacancies yet." branch and never touches `skills`, which is why the crash is data-dependent (≥1 vacancy) rather than truly role-specific.

The existing spec already requires list rows to show skills and support search-by-skill, so the backend omission is a genuine defect against spec — not merely a defensive-coding gap.

## Goals / Non-Goals

**Goals:**
- Eliminate the `/vacancies` crash for lists containing vacancies.
- Restore the spec'd behavior: skill chips per row and search-by-skill.
- Make the page resilient to absent/partial skills so no data shape can crash it.
- Close the test blind spot that let this ship green.

**Non-Goals:**
- Adding taxonomy anchors (L1–L5) to the list response — the list only needs label + expected level.
- Auditing/fixing other resources' list-vs-show asymmetry (e.g., assessments) — noted as a follow-up.
- Any change to vacancy create/edit flows.

## Decisions

**D1 — Backend: index returns lightweight skills, eager-loaded.**
`index` uses `Vacancy.includes(:vacancy_skills)` and emits `skills: [{ id, skill_id, skill_label, expected_level }]` per vacancy. Rationale: matches the single-vacancy contract and the frontend's needs with one extra query total (not per row). Deliberately skips the per-vacancy `SkillTaxonomy` lookup that `vacancy_with_skills_json` does, since the list renders only label + level. Alternative (reuse `vacancy_with_skills_json` as-is) is rejected: it reintroduces a per-vacancy taxonomy query (N+1) for data the list never shows.

**D2 — Frontend: tolerate absent skills; make the type optional.**
`Vacancy.skills` becomes `skills?: VacancySkill[]`. `VacancyListPage` uses `v.skills ?? []` for both render and filter. Rationale: "strict in what you send, lenient in what you accept" — the UI should never error on a partial/legacy payload. The empty case already has a designed "No skills configured" affordance.

**D3 — Audit consumers of the now-optional `skills`.**
Making `skills` optional can ripple to code that assumed it present. Known consumer: `VacancyEditPage` `reset({ skills: v.skills })` — guard as `v.skills ?? []`. `VacancyNewPage`/edit forms otherwise operate on `useFieldArray` state, not `v.skills`. A quick type-check (`tsc`/`vp check`) surfaces any remaining spots.

**D4 — Close the test gap.**
The current `VacancyListPage.test` fixtures hand-build vacancies *with* skills, so a mocked-service unit test can't catch backend drift. Update fixtures to the real list shape and add an explicit resilience case (absent/empty skills → "No skills configured", no error). Add a backend request spec asserting the index includes skills and does so without N+1 (query-count assertion).

## Risks / Trade-offs

- **[Type change ripples]** `skills?` optional may produce new `tsc` errors where non-null was assumed → resolve by guarding those reads (`?? []`); `vp check` is the safety net.
- **[Perf on index]** Now loads skills for every listed vacancy → bounded by `.includes(:vacancy_skills)` (one extra query); no taxonomy lookups.
- **[Deploy ordering]** Frontend tolerates both shapes (with/without skills), so it can ship before or after the backend without a broken intermediate state.
- **[Latent siblings]** Other list endpoints may share the omit-associations-on-index pattern; not addressed here to keep scope tight.

## Migration Plan

Frontend-and-backend change, order-independent (frontend is forward/backward compatible). Validate with backend request spec + `vp check`/`vp test` (web). Manual check: as an admin with ≥1 vacancy, load `/vacancies` and confirm chips render, search-by-skill works, and no error page. Rollback is a straight revert of the two files; no data migration.

## Open Questions

- Should the same fix be applied proactively to the assessments list (if it shares the pattern), or tracked as a separate change? (Leaning separate.)
