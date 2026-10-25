# Assessment — AI Interview Platform

Written deliverables for the Rakamin AI Interview platform assessment. Each finding below carries its own analysis doc in this folder; code changes live in `api/` and `web/`.

This revamp was completed as a candidate applying for **Fullstack Engineer (Frontend Depth)** — the finding selection and the voluntary UI enhancement are weighted to demonstrate both backend security depth and frontend craft (state machines, responsive UI, accessible error handling).

## Scope summary

| Item | Status |
|------|--------|
| Findings fixed (revamp branch `umbrella/revamp-ai-interview`) | **9** ✅ (F-01, F-02, F-03, F-05, F-06, F-07, F-08, F-13, F-26) |
| E2E retest findings fixed (branch `fix/e2e-interview-findings`, PR #12) | **2** ✅ (F-27, F-28) |
| Config/env drift fixed locally (F-29 — note, NOT counted in the 28) | **1** ✅ local (no code artifact, not in PR) |
| Findings not worked (out of scope / deferred, incl. F-18, F-25) | **17** ⏸ |
| Voluntary UI enhancement (branch `feat/ui-enhancement`) | **1** ✅ (see `UI-enhancement.md`) |
| Assessment documentation consistency (docs-only PR) | **1** ✅ (PR #11 — no code change) |

**Total findings audited: 28** (F-01…F-26 + E2E retest F-27, F-28, discovered 2026-08-18 during candidate E2E testing; NEW-F-01 was resolved within F-26 and F-29 is a config note, neither counted). Automated test totals after the verified F-03 administrator-onboarding follow-up: **98 RSpec examples + 61 Vitest tests, all passing** (plus TypeScript and production build checks).

## Findings — status map (join key: original finding number)

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| F-01 | IDOR: Portfolio / PortfolioSkill / FitGapReport accessible across tenants | P0 | ✅ Fixed — `F-01-idor-tenant-scope.md` |
| F-02 | Audio WebSocket: any valid JWT can inject audio into a candidate session | P0 | ✅ Fixed — `F-02-audio-ws-role-check.md` |
| F-03 | Login tenant not bound to user; administrator onboarding not authorized | P1 | ✅ Fixed — tenant-implicit login + invitation-gated administrator signup; `F-03-login-tenant-scheme.md` |
| F-04 | `Organization.identify` falls back to default org (id 0) for unknown identifiers | P2 | ⏸ Not worked |
| F-05 | Candidate invite link points to the backend host, not the web app | P1 | ✅ Fixed — `F-05-invite-url-frontend-host.md` |
| F-06 | `audio_complete` ends a session without coverage verification | P1 | ✅ Fixed — `F-06-audio-complete-authorization.md` |
| F-07 | Candidate UI shows "Interview Complete" when the interview actually failed | P1 | ✅ Fixed — `F-07-interview-error-state.md` |
| F-08 | AI portfolio output not validated → one bad field fails the whole generation | P2 | ✅ Fixed — `F-08-ai-output-validation.md` |
| F-09 | Fit/Gap cached report can be stale; regenerate destroys report before job success | P2 | ⏸ Not worked |
| F-10 | Role `user` cannot log in; no general role-based signup flow | P2 | ⏸ General RBAC remains out of scope; administrator onboarding is securely invitation-gated within F-03 |
| F-11 | `DELETE /assessments/:id` returns success even when destroy fails | P2 | ⏸ Not worked |
| F-12 | Coverage WebSocket assessor without role check | P2 | ⏸ Not worked (incidentally fixed together with F-02 via the shared `WebSocketAuth` concern) |
| F-13 | Hardware check sends traffic to third parties without consent | P2 | ✅ Fixed — `F-13-speed-test-third-party-consent.md` |
| F-14 | `TenantScoped` default scope falls back to `all` when tenant is absent | P2 | ⏸ Not worked (fix risks breaking unwrapped paths) |
| F-15 | Tenant resolution uses JWT without signature verification | P3 | ⏸ Not worked |
| F-16 | Pending session can be ended → portfolio generated from an empty transcript | P3 | ⏸ Not worked |
| F-17 | `advance_stale_partials` marks `covered` without AI verification | P3 | ⏸ Not worked |
| F-18 | Port/config defaults inconsistent (3000 vs 3001) | P3 | ⏸ Not worked |
| F-19 | `system_prompt_generated: true` claimed before the worker finishes | P3 | ⏸ Not worked |
| F-20 | Client-side timer ends interview with `manual_candidate`, not `time_ceiling` | P3 | ⏸ Not worked |
| F-21 | Race condition: analyzer `probe_count` can lose an increment | P3 | ⏸ Not worked |
| F-22 | Status `failed` defined but never used | P3 | ⏸ Not worked |
| F-23 | `candidate_id` / `created_by` without foreign keys or validation | P3 | ⏸ Not worked |
| F-24 | Token sent via WebSocket query string | P3 | ⏸ Not worked |
| F-25 | Frontend type contract inaccurate vs API | P3 | ⏸ Not worked |
| F-26 | Inconsistent API error envelope & silent catches in the frontend | P3 | ✅ Fixed — `F-26-unified-error-envelope.md` |
| F-27 | Candidate cannot start a pending session (WS auth chicken-and-egg) | P1 | ✅ Fixed (E2E retest 2026-08-18) — `F-27-candidate-pending-session-start.md` |
| F-28 | "End Interview" shows "Connection lost" (WS close race) | P2 | ✅ Fixed (E2E retest 2026-08-18) — `F-28-end-interview-connection-lost.md` |
| F-29 | Stale Gemini model names in local config → session fails instantly | P2 | ✅ Fixed locally (config note — not counted in the 28; gitignored config, not in PR) |

## Pull requests (submission trail)

All PRs are merged into `umbrella/revamp-ai-interview` on the `arathfal/ai-interview-platform` fork; this branch is the single story that links them all.

| PR | What it fixes / adds | Tests added (as recorded in each doc) |
|----|----------------------|---------------------------------------|
| [#1 — F-01: Tenant-scope Portfolio module (IDOR fix)](https://github.com/arathfal/ai-interview-platform/pull/1) | Closes cross-tenant access to Portfolio/PortfolioSkill/FitGapReport (P0): `tenant_id` columns + `TenantScoped` + worker/context wrapping | 25 RSpec (model + request) |
| [#2 — F-02: Enforce role check in audio WebSocket (injection fix)](https://github.com/arathfal/ai-interview-platform/pull/2) | Stops any valid JWT (role `user`) from injecting fake audio into candidate sessions (P0): shared `WebSocketAuth` concern, one authz source of truth for REST + WS | +13 RSpec (WS middleware + REST regression); suite 38 |
| [#3 — F-05: Fix candidate invite link to point to web app host](https://github.com/arathfal/ai-interview-platform/pull/3) | Splits `FRONTEND_BASE_URL` from `APP_BASE_URL` so the invite link opens the interview page, not the API (P1) | +3 RSpec; suite 41 |
| [#4 — F-07: Interview error state + error UI + retry](https://github.com/arathfal/ai-interview-platform/pull/4) | Removes the fake "Interview Complete" screen on every failure path; honest per-cause error UI with retry (P1) | +13 Vitest (first frontend test harness) |
| [#5 — F-08: Normalize AI confidence output and partially save portfolio skills](https://github.com/arathfal/ai-interview-platform/pull/5) | Validates/sanitizes AI-generated portfolio output; one bad field no longer fails the whole generation (P2) | +7 RSpec; suite 48 + 13 Vitest regression |
| [#6 — F-13: Self-hosted speed test — zero third-party traffic (UU PDP)](https://github.com/arathfal/ai-interview-platform/pull/6) | Replaces third-party speed-test calls with the platform's own endpoints; skip semantics when measurement fails (P2) | +4 RSpec + 8 Vitest; suite 52 + 21 Vitest |
| [#7 — F-06: Guard audio_complete against unauthorized session end](https://github.com/arathfal/ai-interview-platform/pull/7) | Requires a persisted proof flag before an audio session may end (P1) | +6 RSpec; suite 58 |
| [#8 — F-03: Tenant-implicit login via user↔organization relation](https://github.com/arathfal/ai-interview-platform/pull/8) | Binds each user to one organization; signup flow + password policy groundwork; login no longer routes to an arbitrary tenant (P1) | +18 RSpec + 9 Vitest; suite 76 + 30 Vitest |
| [#9 — F-26: Standardize API error envelope and surface silent failures](https://github.com/arathfal/ai-interview-platform/pull/9) | Unified `{ error: { code, message } }` envelope, toast + inline alerts, frontend error normalizer, contract tests (P3, high frontend depth) | +6 RSpec + 20 Vitest; suite 82 + 50 Vitest |
| [#10 — UI enhancement: mobile responsive + RHF + empty states + password policy](https://github.com/arathfal/ai-interview-platform/pull/10) | Voluntary UI/UX pass across all pages (disqualifier #6): responsive breakpoints, React Hook Form consistency, empty states, 8–72 password contract on both sides | +5 RSpec + 11 Vitest; suite 87 + 61 Vitest |
| [#11 — docs: translate remaining Indonesian assessment docs to English](https://github.com/arathfal/ai-interview-platform/pull/11) | Consistency only — language cleanup of the assessment deliverables; no code change | — |
| [#12 — Fix candidate E2E: pending session start + end-interview connection lost](https://github.com/arathfal/ai-interview-platform/pull/12) | F-27 (P1) + F-28 (P2), found in E2E retest as candidate (2026-08-18): pending session could not start (WS auth chicken-and-egg); "End Interview" surfaced a spurious "Connection lost" | +2 RSpec (11) +1 Vitest (6); suite 88 + 62 Vitest |

## Why the out-of-scope findings were not worked

To be explicit and honest: **not worked ≠ fixed**. These findings are valid observations from the audit but were consciously left out of the 9-finding revamp plan (and the UI enhancement branch) for one of the following reasons. If any of them matters for your review, they are a fair follow-up item.

**1. Resolved incidentally by another finding**

| # | Finding | How it was covered |
|---|---------|--------------------|
| F-10 | Role `user` cannot log in; no general role-based signup flow | Not treated as a generic RBAC fix. The verified F-03 follow-up adds administrator-only invitations with no role selector; the backend assigns `admin` after validating a tenant- and email-bound grant. Supporting other account roles remains a separate product/RBAC decision. |
| F-12 | Coverage WebSocket assessor without role check | Fixed together with F-02: both WS middlewares now reuse the shared `WebSocketAuth` concern (same authorization source of truth as REST) |

**2. Deferred pending an architectural decision (Constraint Signal CS-1 — tenancy strategy)**

| # | Finding | Why deferred |
|---|---------|--------------|
| F-04 | `Organization.identify` falls back to default org (id 0) for unknown identifiers | The audit's own escalation note (CS-1) says fixing tenancy findings one-by-one without a coherent strategy creates more inconsistency; the fallback masks misconfiguration instead of surfacing it — the right fix is part of a tenancy decision, not a one-liner |
| F-14 | `TenantScoped` default scope falls back to `all` when tenant is absent | Same CS-1 dependency, plus the fix risks breaking unwrapped call paths (workers/WS) that legitimately run without a tenant context — needs the strategy decision first |

**3. Priority window / risk-vs-value (P2–P3, no user-visible blocker for the assessment demo)**

| # | Finding | Why not worked |
|---|---------|----------------|
| F-09 | Fit/Gap cached report can be stale; regenerate destroys report before job success | Real behavior gap, but the fix needs staleness tracking + a job-lifecycle redesign (soft-delete / `regenerating` status) — medium risk to the session/portfolio lifecycle, deliberately kept out of the stable 9-finding plan |
| F-11 | `DELETE /assessments/:id` returns success even when destroy fails | Error-handling polish on a non-core path (assessments are rarely deleted); no security/regulatory impact |
| F-15 | Tenant resolution uses JWT without signature verification | Defense-in-depth violation, but the audit's own counter-evidence found **no practical exploit path** — protected endpoints still verify the signature; theoretical risk only |
| F-16 | Pending session can be ended → portfolio from an empty transcript | The normal UI flow never exposes the end action for `pending` sessions (counter-evidence in the audit); the reachable end path (`audio_complete`) is already guarded by F-06 |
| F-17 | `advance_stale_partials` marks `covered` without AI verification | Internal worker semantics; no user-visible misreport in the flows exercised by the demo |
| F-18 | Port/config defaults inconsistent (3000 vs 3001) | Developer experience only, no user/candidate impact; the fix is too thin for its own sub-PR (analysis + trade-offs + tests cost more than the fix is worth); most of the benefit was already covered incidentally by F-05 (URL config split) and the `.env.example`/README documenting `VITE_API_BASE_URL` |
| F-19 | `system_prompt_generated: true` claimed before the worker finishes | Dev-facing flag truthfulness; no user-visible impact |
| F-20 | Client-side timer ends interview with `manual_candidate`, not `time_ceiling` | Affects the recorded `end_reason` label only; no impact on the assessment result |
| F-21 | Race condition: analyzer `probe_count` can lose an increment | Statistics accuracy of the coverage map; no security or regulatory impact |
| F-22 | Status `failed` defined but never used | Dead code; no behavior change |
| F-23 | `candidate_id` / `created_by` without foreign keys or validation | Data-integrity hardening; low exploitability in the current flows |
| F-24 | Token sent via WebSocket query string | The token is short-lived and session-scoped; fixing it changes the WS handshake contract and needs a coordinated frontend+backend change — deferred rather than rushed |
| F-25 | Frontend type contract inaccurate vs API | Pure type-level churn with no runtime/user-visible impact; the most important part of the API contract (error response shape) was already synchronized by F-26 (error types + `extractApiError` + contract test); the remaining mismatches belong in a larger type refactor, not a dedicated sub-PR |

The 9 fixed findings target the highest severities (2 P0, 4 P1, 2 P2, 1 P3 with high frontend depth) plus the voluntary UI enhancement; the remaining 17 P2–P3 items — F-18 and F-25 included — are documented above so the scope decision is auditable rather than silent.

## Voluntary UI enhancement (not part of the 26 findings)

| Item | Status |
|------|--------|
| Mobile responsive across all pages + RHF consistency + empty/loading states + two-sided password policy (8–72) | ✅ `UI-enhancement.md` — branch `feat/ui-enhancement` |

This is a voluntary product improvement aligned with the brief's Step 6 (UI/UX quality, Product Team 50%) and Disqualifier #6 (poor UI = automatic reject). Full analysis, trade-offs, acceptance criteria, tests and verification moments are in `UI-enhancement.md`.

*README aggregated per revamp umbrella + UI enhancement branch.*
