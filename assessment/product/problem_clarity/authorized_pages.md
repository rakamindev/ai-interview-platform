# Authorized Pages — Improvement List

> Grounded in [PRD-01 — First Principles: AI Interview Behavior](https://github.com/rakamindev/ai-interview-platform/wiki/PRD-01-%E2%80%94-First-Principles:-AI-Interview-Behavior) and [PRD-02 — Real Simulation: End-to-End Interview](https://github.com/rakamindev/ai-interview-platform/wiki/PRD-02-%E2%80%94-Real-Simulation:-End%E2%80%90to%E2%80%90End-Interview).
> Scope: the **authorized (post-login) pages** of the AI Interview Platform. Compiled via `/opsx-explore` on 2026-08-16.

## Current authorized surface

**Guard:** `ProtectedRoute` (token-existence check only, **no role check**) wrapping `AssessorLayout` in `web/src/App.tsx`.

| Route | Page | PRD-02 phase |
|---|---|---|
| `/assessments` | AssessmentListPage | P1 hub |
| `/assessments/new` · `/:id/edit` | AssessmentNew/EditPage | P1 config |
| `/assessments/:id/invite` | AssessmentInvitePage | P1 invite |
| `.../sessions/:sid/monitor` | LiveMonitorPage | P3 U5 |
| `.../sessions/:sid/portfolio` | PortfolioPage | P4 U7 |
| `.../sessions/:sid/transcript` | TranscriptPage | evidence |
| `.../sessions/:sid/fitgap/:vid` | FitGapReportPage | P5 U10 |
| `/vacancies` · `/new` · `/:id/edit` | Vacancy pages | P1/P5 |

Token-gated candidate `InterviewPage` (`/interview/:token`) is PRD-02 core but **not** an authorized page — annex only.

---

## 1. Guard layer — biggest gap

**`ProtectedRoute` checks `token` existence only — no role gate.** Signup creates `admin`/`user` roles, yet *any* authenticated user gets the full assessor surface (assessments, vacancies, monitor, portfolios, fit-gap). PRD-02's flow assumes a distinct Assessor (Dimas) and Candidates who enter via invite tokens.

- **Improvement (PRD-02 P1/P5)**: role-gated routes — assessor pages require `admin`; define what `user` can see (or redirect to a candidate-facing view). 403 handling instead of silent render.
- Secondary: 401-on-stale-token currently hard-redirects to `/login`; authorized pages should show "session expired, sign in again" with a friendly retry rather than a jarring full reload.

## 2. AssessorLayout

- Nav covers Assessments + Vacancies only. Add **live-session awareness**: PRD-02 P3 has an assessor live-monitoring job — a "live now" indicator in the header (active session count) would surface it without navigating.
- Missing user identity (email/name) — only tenant chip. Minor.

## 3. AssessmentListPage

- Row shows name, time limit, latest-session chip. PRD-02 P1 hub needs richer triage: **skills count, expected levels, language, candidate/session counts, per-status breakdown** (pending/live/ended/failed). Today a "failed" last session is a red chip; no way to see *which* of many assessments need attention.
- No edit shortcut from list (only via invite page). Add row actions.

## 4. AssessmentNewPage — deviates from PRD-02 P1 setup

- **Missing "role title"** — PRD-02 P1 config includes `Role title: "Senior Frontend Engineer"`; the form only has `name`. Role title lives on vacancies, but the candidate brief (`InterviewPage` shows `role_title`) and the system prompt (PRD-01 §2 `ROLE BEING ASSESSED`) need it. Tie assessment → vacancy, or add role title to the form.
- **No "Save & Create Invite Link" single action** — PRD-02 P1: one click creates config + session + invite link. Current flow: save → invite page → dialog → create session → copy. Three clicks to one.
- **No system prompt preview** — PRD-01 §2: N2 generates the prompt from config. Assessors should preview the compiled prompt before inviting (it's the product's core mechanism per PRD-01: "The system prompt is what makes this happen"). Add a read-only preview/QA affordance.

## 5. AssessmentInvitePage

- Good: per-session status rows, copy link, monitor/results actions, 5s polling while pending/live.
- **No revoke/expire for pending invites** — links stay valid forever; PRD-01/02 assume controlled sessions. Add revoke + visual "expired" state.
- **No transcript shortcut for ended sessions** — only "Results". PRD evidence flow wants direct transcript access.
- Page header shows time-limit + skill count only; PRD-02 P1 invite context would benefit from showing **expected levels + role** so the assessor knows what the invite is for.

## 6. LiveMonitorPage (PRD-02 P3/U5) — strongest page, still gaps

- **Elapsed timer only — no time-remaining countdown.** PRD-02 coverage map carries `time_remaining_minutes` and the flow has "time warning" wrap-ups; the assessor needs remaining time + low-time color shift, not just elapsed.
- **Coverage map lacks probe counts / priority.** PRD-01 §3 map includes `probe_count` and `priority_next`; the monitor renders state labels only. Show probe count + "next priority" so the assessor can QA the interviewer's behavior in real time (observable side of PRD-01 §7 QA checklist).
- **Transcript via 3s polling** — PRD N6 saves turns continuously; push turns over the WS for true real-time + auto-scroll, instead of polling.
- **No candidate identity in header** — monitor shows assessment name only. PRD-02: Dimas watches Ahmad's session; show candidate name + role.

## 7. PortfolioPage (PRD-02 P4/U7)

- Solid: polling while generating, SkillPortfolioCard (level, confidence, evidence, competency summary), OverridePanel with notes (PRD principle: "AI output is a draft, not a verdict"), fit-gap trigger, exports.
- **Evidence quotes are not traceable to the transcript.** PRODUCT.md principle 1 + PRD-01 §5: "every AI skill score must trace to quoted transcript evidence." Deep-link each evidence quote → the exact transcript turn (anchor by turn number/id).
- Override flow is good; add a visible "AI draft vs assessor verdict" framing so the override affordance reads as intended.

## 8. TranscriptPage

- Renders turns, downloads `.txt`. Gaps for the evidence workflow:
- **No timestamps/durations per turn** (N6 stores `ts`; PRD-02 timeline uses them).
- **No speaker filter / search** — evidence hunting in a 41-turn+ session needs filter (AI/candidate) + text search.
- **No anchor support** — needed for PortfolioPage quote deep-links (see #7).
- Export options beyond `.txt` (SRT/JSON with turn ids).

## 9. FitGapReportPage (PRD-02 P5/U10)

- Good: ComparisonTable (match/gap/exceed + delta + override marker + summary), culture & competency narrative, discovered-skills card, regenerate, PDF/JSON export.
- **"not assessed" state** — PRODUCT.md declares match/gap/exceed/**not assessed**, and the table renders `candidate_level == null` as "—"; confirm the badge handles `not_assessed` distinctly (PRD-02 shows the four outcomes).
- **No vacancy context in header** — which vacancy, its role title, and the comparison's expected levels should be visible; currently the vacancyId is invisible in the UI.
- Per-row "view evidence" → portfolio/transcript link.

## 10. Vacancy pages

- List is bare (role title only). Add **skills + expected levels + culture dimensions** summary and a search/filter. PRD-02 P5: vacancies drive fit/gap; the picker on PortfolioPage should show expected levels inline so the assessor picks deliberately.

## Cross-cutting

- **i18n**: PRD-02 supports `en`/`id` interviews; all authorized-page UI is English-only with no i18n infra. At minimum, candidate-facing copy should respect the assessment language.
- **Consistent error states**: several `.catch(() => {})` swallows (InvitePage load, PortfolioPage init, FitGap init) — silent failures; add retry affordance matching the list pages' pattern.
- **Suspense fallback is plain `Loading...`** — a branded skeleton for the authorized shell.
- **Accessibility**: comparison table + session tables want captions/`aria-sort`; monitor coverage map needs text alternatives for color-only states.

---

## Annex (out of scope — token-public, not authorized)

`InterviewPage` already covers PRD-02 P2/P3 well (brief, hardware check, mute-to-start, reconnect banners, drain + safety timeout, `audio_complete` retry). Only candidate-facing i18n and the missing "time warning" from PRD-01 §2 (AI should wrap up on time warning) stand out.

---

## Resolution status (2026-08-16)

Implemented via OpenSpec change `authorized-pages-improvements` (10 groups, 41 tasks). Status per section above:

| # | Section | Status | Notes |
|---|---|---|---|
| 1 | Guard layer | **Resolved** | `authAtom` decodes JWT and exposes `role`; `ProtectedRoute` gates `admin` → assessor surface, `user` → `AccessDeniedPage`; 401 interceptor → `auth:session-expired` → friendly login banner (groups 1.1–1.5). |
| 2 | AssessorLayout | **Resolved** | Live-session indicator (count + link to monitor, 30s poll via new `GET /api/v1/sessions/live`); identity chip from new `GET /api/v1/me` (email, falls back to role) (9.1–9.2). |
| 3 | AssessmentListPage | **Partial** | Assessment create/edit/invite flows improved; per-status row triage breakdown not added (kept scoped to PRD-02 P1 parity tasks in the change). |
| 4 | AssessmentNewPage | **Resolved** | `role_title` field (prefills from linked vacancy); "Save & Create Invite Link" single action (`create_session: true` → invite URL in one response); read-only `SystemPromptPreview` dialog with error/retry (2.1–2.6). |
| 5 | AssessmentInvitePage | **Resolved** | Revoke action + revoked/expired states (7-day default expiry, backfilled migration); transcript shortcut on ended rows; header shows role title + skill count + `<SystemPromptPreview />` (3.1–3.5). |
| 6 | LiveMonitorPage | **Resolved** | Time-remaining countdown with low-time color shift; probe counts + priority-next callout; WS `transcript_turn` push (consumed with dedup, auto-scroll toggle, 3s poll fallback); candidate name + role in header (4.1–4.4). |
| 7 | PortfolioPage | **Resolved** | Evidence quotes deep-link to exact transcript turn (`/transcript?turn=<n>`, unresolved quotes stay plain text); "AI draft" vs "Your verdict" labels formalized; `?skill=` anchor highlight from fit/gap evidence links (5.1–5.3, 7.3). |
| 8 | TranscriptPage | **Resolved** | Per-turn timestamps + durations; speaker filter + search with `<mark>` highlight; `?turn=` anchors with scroll/highlight + graceful fallback; JSON export alongside `.txt` (6.1–6.4). |
| 9 | FitGapReportPage | **Resolved** | Distinct `not_assessed` badge (excluded from summary counts); vacancy context header (role title + expected levels); per-row evidence link → portfolio skill anchor (7.1–7.3). |
| 10 | Vacancy pages | **Resolved** | List rows show skill chips + expected levels + culture summary with search; portfolio fit/gap picker shows skills/levels inline incl. no-skills vacancies (8.1–8.2). |
| — | Cross-cutting | **Resolved (in-scope items)** | Shared `ErrorRetryState` replaces duplicated `.catch(() => {})` blocks (9.4); branded `BrandedSkeleton` Suspense fallback (9.3); a11y: table caption/`scope`, text+color coverage states confirmed, no sortable columns needing `aria-sort` (9.5). i18n remains out of scope (candidate-facing only). |

**Verification** (group 10): `vp check --fix` clean (0 errors; 32 pre-existing `HardwareCheck.tsx` no-floating-promises warnings unchanged), `tsc --noEmit` clean, `vp build` passed; `ruby -c` clean on all changed backend files; `rails routes` confirms `api_v1_me` + `live_api_v1_sessions`; integration smoke test passed (login → create assessment with `role_title` + `create_session` → invite URL → sessions list with 7-day `expires_at` → transcript shape → `/me` → `/sessions/live`; unauthenticated → 403). API has no spec suite to run.