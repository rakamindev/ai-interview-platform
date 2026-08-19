## Context

The authorized pages (11 routes behind `ProtectedRoute` + `AssessorLayout`) serve assessors across the PRD-02 lifecycle: assessment config (P1), invite (P1), live monitoring (P3/U5), portfolio review (P4/U7), transcript review (evidence), and fit/gap (P5/U10). PRD-01 defines the AI behavior contract (system prompt, coverage map with probe counts and priority, evidence-quoted scoring) that these pages must make observable and actionable.

Current state (verified in code):
- `ProtectedRoute.tsx` checks only `token` existence — no role gate, despite `admin`/`user` roles on signup.
- `AssessmentNewPage` has name/time-limit/language/skills but no role title; save navigates to invite page where a session + link are created in a separate step.
- `LiveMonitorPage` shows elapsed time only, coverage state labels without probe counts/priority, and polls transcript every 3s.
- `PortfolioPage` renders evidence quotes as static text — no link to the transcript turn.
- `TranscriptPage` shows plain turns, `.txt` download only, no timestamps/filter/search/anchor support.
- `FitGapReportPage`/`ComparisonTable` handle match/gap/exceed; "not assessed" renders as "—" without a distinct state.
- Errors: several `.catch(() => {})` swallows; Suspense fallback is plain "Loading...".

Constraints: JWT already carries a role claim (signup role); multi-tenant (tenant from `tenantAtom`); WebSocket infra exists (`useCoverageWebSocket`, `useAudioWebSocket`) on Rails backend with Sidekiq/Redis.

## Goals / Non-Goals

**Goals:**
- Bring authorized pages to PRD-01/02 parity: role-gated access, PRD-02 P1 config flow, live monitor with time-remaining + probe detail, evidence-to-transcript traceability, complete fit/gap states, richer invite/vacancy surfaces.
- Reuse existing patterns: React Hook Form + Zod, Radix UI, Jotai, `usePolling`, existing WS hooks, `cn()`/shadcn primitives, existing API client conventions.
- Keep changes additive where possible (new endpoints, new route guards) so rollback is per-feature.

**Non-Goals:**
- i18n infrastructure / language-localized UI (noted as out of scope in proposal).
- Interview-page (candidate token flow) behavior changes.
- AI prompt/behavior changes (backend model config).
- Data model redesign — expect additive columns/endpoints only.

## Decisions

### D1: Role gate via JWT claim, not a new table
`ProtectedRoute` becomes a role-checking wrapper reading the token's role (decode JWT payload already stored by `saveToken`; or backend `/me` endpoint). Assessor routes require `admin`. Non-admin `user` → redirect to a placeholder "no access" route or a candidate-facing home. Stale-token 401s: keep the existing `AUTH_PATHS` exemption in `api.ts`, and add a one-time "session expired" banner + sign-in redirect (not a silent hard reload).
- Alternative considered: per-route role config in the route table (heavier, no current need); server-side enforcement only (already exists via 401/403 — the UI gate is about UX, not security).

### D2: Role title joins the assessment form (denormalized, mirroring PRD-02 P1)
Add `role_title` to assessment config (form field, defaulting from linked vacancy when applicable). The interview brief and system prompt already consume `role_title` from candidate info; making it first-class on the assessment removes the current inconsistency where vacancies hold it but assessments don't.
- Alternative considered: force a vacancy link on assessment (rejected — assessments can exist pre-vacancy).

### D3: "Save & Create Invite Link" = one endpoint call, two resources
`POST /api/v1/assessments` gains an optional `create_session: true` flag (or a dedicated `POST /api/v1/assessments/:id/sessions?return_link=true`) that creates the assessment + first session + invite token and returns the invite URL, matching PRD-02 P1's single action. The existing invite dialog stays for additional candidates.

### D4: System prompt preview is read-only, backend-compiled
`GET /api/v1/assessments/:id/system_prompt` returns the compiled prompt (N2-equivalent) from the saved config. Preview renders in a read-only dialog/panel on the assessment config and invite pages. No editing — it is generated (PRD-01 §2).
- Alternative considered: client-side template compile (rejected — duplicates N2 logic, drifts from backend).

### D5: Live monitor — remaining time from coverage map + WS transcript push
- Extend `useCoverageWebSocket` payload consumption: the existing coverage map already carries `time_remaining_minutes`; monitor renders elapsed + remaining with low-time color shift.
- Coverage cards show `probe_count` and a "priority next" callout (map state labels already exist in `COVERAGE_STATE_*` constants — add probe count rendering).
- Transcript: add a WS push event for new turns (backend N6 already saves turns; emit a `transcript_turn` event) with fallback to the existing 3s polling when WS is unavailable. Auto-scroll toggle.
- Candidate identity: `sessionsApi.get` already returns `candidate_name` — render in header.

### D6: Evidence → transcript deep links via turn anchors
Transcript turns have stable ids/turn numbers. Portfolio evidence quotes link to `/transcript?turn=<n>` (or `#turn-<n>`); TranscriptPage scrolls to and highlights the turn. Backend: ensure transcript API exposes `turn_number` + `ts` (already does per N6; expose `ts` if not currently serialized).

### D7: Fit/gap "not assessed" as a first-class result state
`ComparisonTable` already has an else-branch icon "—"; add `not_assessed` to `FIT_GAP_RESULT_LABELS`/`FIT_GAP_RESULT_CLASSES` constants with an explicit badge. Vacancy context header: `sessionsApi`/`portfoliosApi` already return vacancy data — render role title + expected levels from the report.

### D8: Invite lifecycle — revoke/expire
Add `POST /api/v1/sessions/:id/revoke` (sets `status: revoked` or `expires_at`). Invite rows render an expired/revoked state and disable copy/monitor actions. Transcript shortcut button added to ended-session rows (route exists).

### D9: Assessor shell polish
- Header: live-session count pill (poll `GET /assessments?status=active` or WS event), user identity from JWT/`/me`.
- Suspense fallback → branded skeleton component (reuse existing `Skeleton`).
- Standardize error states: extract a shared `ErrorState`/`RetryState` component for list/init failures; replace `.catch(() => {})` swallows with visible retry.

### D10: Vacancy picker shows expected levels
PortfolioPage vacancy `<SelectItem>` labels include skill count + expected levels summary (vacancies API already returns skills with expected levels).

## Risks / Trade-offs

- [Role gating breaks current non-admin users] → Mitigation: this is the intended PRD-aligned change; explicit redirect destination + "contact assessor" message; documented as **BREAKING** in proposal.
- [New endpoints (revoke, system_prompt, create-session flag) increase backend surface] → Mitigation: additive, no schema redesign; follows existing controller conventions; `ruby -c` + route tests.
- [WS transcript push adds backend event complexity] → Mitigation: polling fallback retained; push is an enhancement, not a hard dependency.
- [Evidence deep-links break if turn ids change] → Mitigation: link by `turn_number` (stable per session), not DB id.
- [System prompt preview may expose prompt internals] → Mitigation: read-only, assessor-only (role-gated), same access as the rest of the assessor surface.

## Migration Plan

1. Ship role gate (D1) first — smallest, highest-impact, **BREAKING**.
2. Backend additions (D3, D4, D8, D6 `ts` exposure) behind existing route conventions; no migrations beyond additive columns if any (`role_title` on assessments).
3. Frontend page work per capability, each independently shippable.
4. Rollback: revert route gate + feature flags per endpoint; no data migration to undo.

## Resolved Questions (grounded in PRD-01/02)

### R1: What does a non-admin `user` role see after login?
**Answer: No assessor surface — redirect to access-denied; the candidate experience stays token-based.**
PRD-02 defines exactly two entry surfaces and never mixes them: candidates enter through invite tokens (Phase 2: "Ahmad opens link on laptop, sees interview page" — no login involved), and assessors use the authenticated session (Phase 1: Dimas opens the Assessor Config page). No PRD describes a logged-in candidate dashboard or any authenticated `user`-role surface. Therefore the `user` role after login gets the access-denied view with a sign-out/contact-assessor message; the candidate flow remains purely token-gated (`/interview/:token`), exactly as PRD-02 specifies. If the Rakamin product later defines an authenticated candidate portal, that is a separate change — out of scope here.

### R2: Do existing pending invites get a default expiry?
**Answer: Yes — uniform default expiry across all pending invites, backfilled on deploy.**
PRD-02's session lifecycle is `pending → active → ended` with end reasons (Phase 2/3), and PRD-01 §7's QA framing assumes controlled sessions; neither defines an expiry concept, but neither permits indefinitely-valid links either — invites exist to be opened once per candidate. Decision: newly created invites get a configurable default expiry (e.g., 7 days); existing pending invites are backfilled with the same default in the deploy migration so behavior is uniform across the fleet and no legacy link stays valid forever. Expiry records an `expired` end reason/state consistent with the existing `error`/`all_covered` end-reason vocabulary. Active sessions are never expired.

### R3: Is `role_title` on assessments authoritative or vacancy-synced?
**Answer: Assessment `role_title` is authoritative; a linked vacancy only prefills it.**
PRD-02 Phase 1 puts "Role title" directly on the Assessor Config page — it is the role being interviewed for, consumed by the candidate brief and the system prompt (PRD-01 §2 `ROLE BEING ASSESSED`). Vacancies enter the story later, in Phase 5, as the fit/gap comparison baseline (candidate portfolio vs. vacancy expected levels), not as the source of the interview's role. Therefore: `assessment.role_title` is the single source of truth for the interview; when an assessment is created from/linked to a vacancy, the vacancy's role title prefills the field but edits do not mutate the vacancy. This keeps the PRD's separation — config defines the role being assessed, vacancy defines the comparison target.