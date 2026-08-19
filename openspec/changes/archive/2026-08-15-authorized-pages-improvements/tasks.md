## 1. Role-based access (D1 — ship first, BREAKING)

- [x] 1.1 Decode JWT payload in `web/src/stores/authAtom.ts` (or `saveToken`) and expose `role` claim via an atom/selector
- [x] 1.2 Rework `web/src/components/ProtectedRoute.tsx` to check role: `admin` → assessor surface; `user` → redirect to access-denied destination; no token → `/login`
- [x] 1.3 Add an access-denied view for non-admin authenticated users (message + sign out / contact-assessor note)
- [x] 1.4 Add session-expired handling: on 401 from authorized-page requests, clear token, show "session expired" state with sign-in action (extend `api.ts` interceptor beyond the existing `AUTH_PATHS` exemption without breaking login-error display)
- [x] 1.5 Update `web/src/App.tsx` route tree to wrap assessor routes with the role-gated guard

## 2. Assessment config (D2, D3, D4)

- [x] 2.1 Backend: add `role_title` column to assessments (migration) + permit in controller params; return in serializers
- [x] 2.2 Backend: `POST /api/v1/assessments` accepts `create_session: true` → creates assessment + first pending session + invite token, returns invite URL
- [x] 2.3 Backend: `GET /api/v1/assessments/:id/system_prompt` returns compiled prompt (N2-equivalent) from saved config
- [x] 2.4 Frontend: add role title field to `AssessmentNewPage`/`AssessmentEditPage` (prefill from linked vacancy when present)
- [x] 2.5 Frontend: add "Save & Create Invite Link" action (primary) alongside "Save" on the assessment forms; on success show the invite link for copying
- [x] 2.6 Frontend: system prompt preview (read-only dialog) on assessment config and invite pages; surface fetch errors with retry

## 3. Invite management (D8)

- [x] 3.1 Backend: `POST /api/v1/sessions/:id/revoke` sets revoked state (and/or `expires_at` on create)
- [x] 3.2 Backend: expose `expires_at`/revoked state in session serializer
- [x] 3.3 Frontend: invite rows render revoked/expired states; disable copy-link and monitor actions for them; revoke action on pending rows
- [x] 3.4 Frontend: transcript shortcut button on ended-session rows in `AssessmentInvitePage`
- [x] 3.5 Frontend: invite header context summary (role title, skill count, expected levels per skill)

## 4. Live monitoring (D5)

- [x] 4.1 Frontend: render time-remaining (from coverage map `time_remaining_minutes` or start+limit) + low-time color shift in `LiveMonitorPage`
- [x] 4.2 Frontend: coverage cards show probe counts + priority-next callout (extend `COVERAGE_STATE_*` usage; verify coverage map shape in `useCoverageWebSocket`)
- [x] 4.3 Backend: emit `transcript_turn` WS event on N6 turn save; frontend `useCoverageWebSocket` (or new hook) consumes it, appends turns, auto-scroll toggle; keep 3s polling fallback
- [x] 4.4 Frontend: candidate name + role in monitor header (from `sessionsApi.get`)

## 5. Portfolio review (D6)

- [x] 5.1 Backend: ensure transcript API exposes `turn_number` and `ts` per turn
- [x] 5.2 Frontend: evidence quotes in `SkillPortfolioCard` link to `/transcript?turn=<n>`; un-resolvable quotes render as plain text
- [x] 5.3 Frontend: AI-draft vs assessor-verdict labels around `OverridePanel` (distinct "AI" vs "You overridden" framing, already partially present — formalize)

## 6. Transcript viewing (D6, D7)

- [x] 6.1 Frontend: render per-turn timestamps in `TranscriptPage` (from `ts`)
- [x] 6.2 Frontend: speaker filter (AI/candidate/all) + text search with highlight
- [x] 6.3 Frontend: turn anchors — read `?turn=<n>` on load, scroll + highlight; graceful fallback for missing anchor
- [x] 6.4 Frontend: structured export (JSON with turn ids/timestamps; optional SRT) alongside existing `.txt`

## 7. Fit/gap review (D7)

- [x] 7.1 Frontend: add `not_assessed` to `FIT_GAP_RESULT_LABELS`/`FIT_GAP_RESULT_CLASSES`; render distinct badge when `candidate_level == null`; exclude from summary counts
- [x] 7.2 Frontend: vacancy context in `FitGapReportPage` header (role title + expected levels) from report/portfolio data
- [x] 7.3 Frontend: per-row evidence link → portfolio/transcript focused on that skill

## 8. Vacancy pages (D10)

- [x] 8.1 Frontend: `VacancyListPage` rows show skills + expected levels + culture dimensions summary; add search/filter by role title or skill
- [x] 8.2 Frontend: portfolio fit/gap vacancy picker options show skills + expected levels inline (handle no-skills vacancy)

## 9. Assessor shell (D9)

- [x] 9.1 Frontend: live-session indicator in `AssessorLayout` header (count + link to monitor; poll or WS)
- [x] 9.2 Frontend: assessor identity (name/email) in header from token claims (fallback `/me` if needed)
- [x] 9.3 Frontend: branded skeleton Suspense fallback replacing plain "Loading..."
- [x] 9.4 Frontend: shared error/retry state component; replace `.catch(() => {})` swallows in `AssessmentInvitePage`, `PortfolioPage`, `FitGapReportPage` init paths
- [x] 9.5 Frontend: accessibility — table captions/`aria-label`, `aria-sort` on sortable columns, text+color coverage states confirmed

## 10. Verification

- [x] 10.1 Run `vp check` (web) — formatting, lint, types clean on changed files
- [x] 10.2 Run backend checks: `ruby -c` on changed files, `bundle exec rails routes` for new endpoints, relevant model/request specs
- [x] 10.3 Manual flow pass: admin login → create assessment with role title → Save & Create Invite Link → monitor live session (remaining time, probe counts, live turns) → portfolio evidence deep-link → fit/gap with vacancy context → non-admin access denied
- [x] 10.4 Update `assessments/product/problem_clarity/authorized_pages.md` with resolution status per item