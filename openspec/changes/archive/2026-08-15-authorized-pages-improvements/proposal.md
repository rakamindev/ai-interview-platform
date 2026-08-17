## Why

The authorized (post-login) pages of the AI Interview Platform currently fall short of what PRD-01 (AI Interview Behavior) and PRD-02 (Real Simulation) promise to assessors. The guard layer grants every authenticated user the full assessor surface regardless of role; assessment config lacks the role title and one-click "Save & Create Invite Link" flow PRD-02 Phase 1 specifies; the live monitor omits time-remaining and probe-count information PRD-01's coverage map defines; and portfolio evidence quotes cannot be traced back to the transcript, breaking the product's core "evidence over assertion" principle. This change brings the authorized pages in line with the PRDs.

## What Changes

- **Role-gated access**: authorized routes require the `admin` role; non-admin authenticated users get a defined destination or 403 state; stale-token 401s show a friendly "session expired" retry instead of a hard reload. (**BREAKING** for any non-admin `user` role currently reaching assessor pages.)
- **Assessment config**: role title added to the assessment form (or vacancy tie-in); "Save & Create Invite Link" single-action flow; read-only system prompt preview generated from config (PRD-01 §2).
- **Invite management**: revoke/expire pending invites with visible state; direct transcript shortcut for ended sessions; expected levels + role shown in the invite header.
- **Live monitor**: time-remaining countdown vs. assessment time limit with low-time color shift; coverage map shows probe counts and priority-next; transcript streamed over the WebSocket instead of 3s polling; candidate identity in header.
- **Portfolio review**: each evidence quote deep-links to the exact transcript turn; "AI draft vs. assessor verdict" framing around overrides.
- **Transcript viewing**: per-turn timestamps, speaker filter, text search, anchor support for evidence deep-links, JSON/SRT export with turn ids.
- **Fit/gap review**: distinct "not assessed" result state; vacancy context (role title, expected levels) in the header; per-row evidence links.
- **Vacancy pages**: richer list rows (skills, expected levels, culture dimensions), search/filter, expected levels shown inline in the portfolio fit-gap vacancy picker.
- **Assessor shell**: live-session indicator in the header, user identity display, branded Suspense fallback, consistent error/retry states, accessibility basics (table captions, `aria-sort`, text alternatives for color-only coverage states).

## Capabilities

### New Capabilities
- `role-based-access`: role-gated routing, 403/redirect handling, session-expired UX on stale tokens
- `assessment-config`: assessment form additions (role title), save-and-create-invite flow, system prompt preview
- `invite-management`: invite lifecycle (create, copy, revoke, expire), per-session actions, invite context summary
- `live-monitoring`: real-time session monitoring (remaining time, coverage map detail, live transcript, candidate identity)
- `portfolio-review`: portfolio rendering with evidence-to-transcript traceability and override framing
- `transcript-viewing`: transcript rendering, filtering/search, anchors, exports
- `fit-gap-review`: fit/gap report rendering with complete result states, vacancy context, evidence links
- `vacancy-management`: vacancy listing with assessment-relevant summaries and deliberate fit-gap selection
- `assessor-shell`: authorized app chrome (nav, identity, live indicator, loading, error/retry, accessibility)

### Modified Capabilities
<!-- No existing specs in openspec/specs/ — all capabilities are new. -->

## Impact

- **Frontend** (`web/src/`): `App.tsx` (route gating), `ProtectedRoute.tsx`, `AssessorLayout.tsx`, `components/ProtectedRoute` role logic, all authorized pages listed in `assessments/product/problem_clarity/authorized_pages.md` (assessment list/new/edit/invite, monitor, portfolio, transcript, fit-gap, vacancy pages), `services/*` (new endpoints as needed), `hooks/useCoverageWebSocket` (transcript push), `types/index.ts`.
- **Backend** (`api/`): role claims already exist on JWT (signup `role`); may need invite revoke/expire endpoints, transcript turn metadata (timestamps) exposure, and system-prompt compilation endpoint for preview. No data-model redesign expected.
- **Spec reference**: PRD-01 §2 (system prompt), §3 (coverage map), §5 (portfolio generator), §7 (QA failure modes); PRD-02 Phase 1 (setup), Phase 3 (U5 monitor), Phase 4 (U7 portfolio), Phase 5 (U10 fit/gap).
- **Out of scope for this change**: full i18n infrastructure (candidate-facing language UI), interview-page behavior changes (token-gated candidate flow), AI prompt/behavior changes.