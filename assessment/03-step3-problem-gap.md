# Step 3 — Problem & Gap Analysis

> Case study: Fullstack Product Engineer — AI Interview Platform
> Findings severity-ranked P0–P3. Each finding: type (never defined / defined but broken), one-line impact statement.
> Evidence from code audit + live DB inspection + real API calls + local runtime.

Legend:
- **ND** = never defined (the spec never existed)
- **DB** = defined but broken (spec exists, implementation is wrong)
- **SEAM** = finding on the data-computation ↔ frontend-presentation boundary

---

## Core Problem Statement

**The product cannot complete a single trustworthy interview end-to-end: the invite link
candidates receive is broken, the interview session auto-ends with an error because the
configured Gemini model is deprecated (and the provided keys have no live access), and
even when results would be produced, there is no test harness to prove correctness, no
auditable evidence trail, and no lawful basis for processing candidate data (UU PDP).**

Three layers of the gap:

1. **Flow is broken before it starts** — P0-1 (invite link → API) and P0-2 (session auto-ends with error) mean the core promise (candidate talks to AI, gets assessed) does not happen at all.
2. **Even if the flow runs, the output cannot be trusted** — P0-3 (no tests, non-deterministic AI), P1-3 (worker idempotency / auto-advance can mis-rate), P1-2 (portfolio generation fails with no recovery).
3. **The product is not lawful or honest with its most vulnerable stakeholder** — P0-4 (UU PDP: no consent, plaintext sensitive data, no audit, cross-border transfer) and P1-5 (candidate told "Completed" when the system failed).

---

## P0 — Product unusable / dangerous

### P0-1. Invite link points to the API, not the frontend → candidate cannot start the interview
- **Type:** DB
- **Evidence:** `api/app/models/session.rb:29-30` — `invite_url` = `APP_BASE_URL + /interview/:token`. `APP_BASE_URL` in config = `http://localhost:3001` (API). Generated link = `http://localhost:3001/interview/<token>` → **Rails Routing Error** (verified live). Frontend lives on `:5173`.
- **Impact:** Assessor copies the link from the invite page, candidate receives a broken link → the interview never starts. The product fails at its most basic step.
- **Note:** `APP_BASE_URL` is also used as the API base URL → dual-purpose env, one change touches two different meanings.

### P0-2. Interview session auto-ends (10s) with `end_reason=error`
- **Type:** DB
- **Evidence:** Live log: `models/gemini-2.0-flash-live-001 is not found for API version v1beta, or is not supported for bidiGenerateContent`. The model in `application.yml` is deprecated. `AudioWebSocketMiddleware` retries 3x, fails → session ended, portfolio created with `generation_status=failed`. (Verified: session id=2 ended error, 0 turns.)
- **Impact:** A candidate who successfully opens the interview is immediately kicked out with a "Failed" status and no understandable message. No interview happens.
- **Note:** Also tied to external dependency — even with a correct model, the key must have Gemini Live access (paid); all 3 local keys tested failed to open a live session (quota/plan).

### P0-3. No test harness at all (API + web + CI)
- **Type:** ND
- **Evidence:** `api/spec` is empty/absent, web has no test runner, no CI config. Step 1 of the brief confirms this is the baseline to build.
- **Impact:** Every change ships unverified; regressions go undetected. Combined with non-deterministic AI scoring, it is impossible to prove product correctness.

### P0-4. UU PDP non-compliance (candidate) — no consent, sensitive data exposed
- **Type:** ND
- **Evidence:** Session has no consent record (schema); transcripts stored plaintext (`transcript_turns.text`); invite token in URL (`/interview/:token`) which can leak via history/logs; no access audit log (UU Pasal 31); Gemini receives raw transcript off to Google (cross-border transfer, Pasal 56) without disclosure. `candidate_name` is free text, no structured candidate identity → cannot satisfy the right to erasure (Pasal 8) or objection to automated decisions (Pasal 10).
- **Impact:** The product assesses biometric data (voice) and candidate evaluation data without a lawful basis → risk of administrative sanctions (2% of revenue) + criminal (up to 6 years) + reputational damage.
- **Supporting evidence:** `sessions.candidate_id` exists in schema but is always `null` — the invite dialog only collects `candidate_name` (free text), so no structured candidate identity is ever created. Even the UI's own intent (identify the candidate) is half-implemented.

---

## P1 — Core feature broken / loses primary function

### P1-1. Auth trusts JWT claims without DB lookup; login is admin-only; there are no users
- **Type:** DB
- **Evidence:** `api/app/auth/authorize_api_request.rb:8` — "Does NOT hit the database for user lookup — trusts the JWT claims." `User.count = 0` (seed creates no users). `AuthenticationController#authenticate` enforces `user.role == 'admin'` (line 14). JWT `user_id` need not be valid; the `role` claim is trusted as-is.
- **Impact:** Anyone who can sign a JWT (shared secret with rakamin-api) can escalate role; assessors cannot log in through the UI because no users exist; accounts cannot be revoked because there is no lookup.

### P1-2. Portfolio generation fails and the UI offers no way out
- **Type:** DB
- **Evidence:** `Portfolio.all` → `status=failed, error="Failed to open TCP connection to generativelanguage.googleapis.com:443 (execution expired)"` after 3 retries. The portfolio page (web) shows status; the only recovery is a not-obvious regenerate endpoint.
- **Impact:** The interview completes but results (L1–L5 ratings + evidence) are lost — assessor cannot review/export, candidate gets no evaluation.

### P1-3. Worker idempotency & auto-advance can produce wrong ratings [SEAM]
- **Type:** ND
- **Evidence:** `coverage_analyzer_worker.rb` — `retry: 0`; no unique job key (double-enqueue can bump probe_count twice). `advance_stale_partials` (lines 91-101) auto-moves `partial → covered` without Gemini verification as long as probe_count ≥ 4 and the skill is outside the context window — yet `covered` is the gate for ending the session and the basis for L1–L5 ratings.
- **Impact:** A skill can be marked "covered" without evidence → premature interview end / inaccurate ratings; results affect real hiring decisions.

### P1-4. `audio_complete` is a public endpoint — anyone with the token can end the session
- **Type:** DB
- **Evidence:** `sessions_controller.rb:115-129` — no JWT, invite token in URL, directly calls `EndHandler.call(reason: 'all_covered')` with no coverage check (H1 fix comment). A leaked token (URL history) → the session can be ended by a third party.
- **Impact:** A candidate's interview session can be terminated by anyone who happens to hold the link.

### P1-5. Candidate UI shows "Completed" for a failed (error) session [SEAM]
- **Type:** DB
- **Evidence:** `web/src/hooks/useAudioWebSocket.ts:103` — `case "session_ended": onStateChange("complete")` without reading `msg.reason`. `InterviewPage.tsx:51` — `.catch(() => setInterviewState("complete"))` even turns a fetch failure into "complete". Backend sends `session_ended` + `reason: 'error'` (audio_websocket_middleware.rb:388). Verified live: candidate sees "reconnecting… → Completed", assessor dashboard shows "Failed".
- **Impact:** Candidate believes the interview finished normally when the system actually failed → no honest feedback, lost trust, and the error is invisible to the very person most affected.

---

## P2 — Poor UX / extra work / confusing

### P2-1. B7 taxonomy skills are saved without `skill_id` [SEAM]
- **Type:** DB
- **Evidence:** `web/src/components/assessment/SkillPicker.tsx:41` — `onSelect({ skill_id: undefined, ... })`. The taxonomy has a unique `skill_id` (`SK-ENG-001` etc.) but it is not sent when the assessment is saved.
- **Impact:** The taxonomy link is lost; UI cannot distinguish B7 vs custom skills (only via `is_custom=false`), and "which skills were assessed" cannot be traced back to source.

### P2-2. Signup page is not routed
- **Type:** ND
- **Evidence:** `web/src/pages/auth/SignupPage.tsx` exists, but `App.tsx` only routes `/login`. `authApi.signup` also hits `/signup` while login hits `/auth/login` — inconsistent prefix.
- **Impact:** A written feature is unreachable; dead code + an API endpoint that may not exist in the backend (routes.rb has no signup).

### P2-3. Create session has no error handling
- **Type:** DB
- **Evidence:** `AssessmentInvitePage.tsx:164-176` — `handleInviteCandidate` has `try/finally` with no `catch`; the API error is swallowed, the dialog closes, the user gets no feedback.
- **Impact:** If creating a session fails (e.g. network), the user sees the dialog disappear with no feedback — believing the link was created.

### P2-4. Legacy assessments (1, 2) have `system_prompt = null`
- **Type:** DB
- **Evidence:** DB: assessments 1, 2 → `prompt_generated=NO`. `SystemPromptGeneratorWorker` (enqueued at create) never produced a prompt for data imported/created outside the flow.
- **Impact:** Sessions from these assessments have no system prompt → the AI interviews without rubric instructions.

### P2-5. No 404 page — unknown routes render a blank screen
- **Type:** ND
- **Evidence:** `App.tsx` has no wildcard route (`*`) and no `NotFound` component. Navigating to an unknown URL (e.g. stale invite link, typo) renders an empty page with no message or navigation back.
- **Impact:** Users who hit a wrong/dead link see a blank page and cannot recover; looks broken, increases support load.

### P2-6. Setup config references deprecated Gemini models; docs lack key/live guidance
- **Type:** DB
- **Evidence:** `config/application.yml.sample` and `api/README.md` reference `gemini-2.0-flash-live-001` / `gemini-2.0-flash-001` / `gemini-2.0-pro-001` — no longer available in the Gemini API (verified: live session rejected `is not found for API version v1beta`). README does not document that Gemini Live requires a paid/licensed key; the brief contains no API-key guidance. Current valid choices: live `gemini-3.8-live`, flash `gemini-2.5-flash`, pro `gemini-2.5-pro`.
- **Impact:** Anyone setting up fresh gets a broken interview immediately (P0-2) and cannot know why; docs silently point to dead models.

---

## P3 — Polish / minor

### P3-1. Minimal error-state UI
- `api.ts` interceptor: 401/403 → `window.location.href = "/login"` with no message telling the user why they were logged out.
- Hardware check failure → "fail" status with no actionable remediation guidance.

### P3-2. Missing empty/partial states on some pages
- Monitor page, transcript page: loading skeletons exist, but long-text/partial turns (AI interrupting) are not visually verified.

---

## Constraint Signal (to escalate to the Technical Lead)

1. **Hard external dependency: Gemini Live (paid + model lifecycle).** The interview cannot run without a live-licensed key and a still-supported model. `gemini-2.0-flash-live-001` is already deprecated → need model config + deprecation monitoring, plus a decision: is realtime audio interview a fixed business requirement, or is a fallback needed (e.g. REST audio streaming)?
2. **End-to-end verification blocked by licensing.** No live key → the interview behavior (probing, coverage, auto-end) cannot be verified for real. All audit/implementation work in this area is code + unit-test based.
3. **No test infrastructure (API/web/CI).** Building a harness is a prerequisite for proving any change — this is Step 5 work that must start from zero.
4. **Auth coupling with rakamin-api (shared JWT secret).** A secret/token change on one side breaks the other; without DB lookup, revoke and identity audit are impossible.
5. **The UU PDP gap needs product + legal decisions**, not just code: retention policy, consent wording, DPIA, cross-border transfer. Engineering can only implement once direction is set.
6. **`APP_BASE_URL` semantic ambiguity** (dual-purpose: API base + invite URL) — sooner or later breaks links in other environments (exactly what happened locally).

---

## Summary

| # | Finding | Type | Sev |
|---|---|---|---|
| P0-1 | Invite link points to API, not frontend | DB | P0 |
| P0-2 | Session auto-end error (deprecated model + key without live access) | DB | P0 |
| P0-3 | No test harness (API+web+CI) | ND | P0 |
| P0-4 | UU PDP non-compliance (consent, plaintext, token in URL, no audit) | ND | P0 |
| P1-1 | Auth trusts claims, admin-only login, no users | DB | P1 |
| P1-2 | Portfolio generation fails without recovery | DB | P1 |
| P1-3 | Worker idempotency + auto-advance wrong ratings [SEAM] | ND | P1 |
| P1-4 | Public `audio_complete` ends session | DB | P1 |
| P1-5 | Candidate UI "Completed" for errored session [SEAM] | DB | P1 |
| P2-1 | B7 skill loses skill_id [SEAM] | DB | P2 |
| P2-2 | Signup page dead route | ND | P2 |
| P2-3 | Create session without error handling | DB | P2 |
| P2-4 | system_prompt null on legacy assessments | DB | P2 |
| P2-5 | No 404 page — blank screen | ND | P2 |
| P2-6 | Setup config references deprecated models / no key guidance | DB | P2 |
| P3-1 | Minimal error-state UI | ND | P3 |
| P3-2 | Missing empty/partial states | ND | P3 |