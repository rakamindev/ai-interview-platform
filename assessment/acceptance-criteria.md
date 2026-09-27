# Acceptance criteria: "When an interview fails, say why, and let people act on it"

Written 2026-09-25, **before any implementation**, and extended as manual QA found new cases (each addition is dated).
Scope locked: 2026-09-25. Evidence: the walk-through findings in `report.md`.

These were written **before** implementation, as the brief requires. Each criterion is
Given / When / Then and names the test level that will prove it. IDs (`S1-AC1` …) are
referenced from tests and the PR.

Open design decisions (§6) are deliberately *not* settled here. They get resolved in the
options comparison (block 2), and a few ACs are marked with the decision they depend on.

---

## 1. Who and why

| Role | Problem today (verified) | Outcome after the revamp |
|---|---|---|
| **Assessor** | Sees a red "Failed" label with no reason. The cause exists only in the server log (finding 3). | Sees *why* the interview failed in plain language, and can decide what to do (fix the assessment, re-invite, ignore). |
| **Candidate** | Stuck in an endless "Reconnecting…" loop, told only to "contact the interviewer" (finding 2: 107 reconnects). | Gets one clear, final message and no loop. |
| **Assessor (setup)** | Can save an assessment with a duplicated skill, which guarantees every interview for it fails (finding 2), and can't remove the duplicate afterwards (finding 5). | Duplicates are rejected with a clear message. Removing a skill in Edit actually removes it. |

---

## 2. Story S1: record why a session failed, and show it to the assessor

**Failure reason codes** (catalog, plain-language labels; final names depend on D4):

| Code | Set when | Assessor sees |
|---|---|---|
| `assessment_invalid` | The interview can't start because the assessment's configuration is invalid (for example duplicate skills, `PG::UniqueViolation` in `StartHandler`) | "Interview couldn't start: this assessment's skills are misconfigured (duplicate skill: *<label>*). Fix the assessment and re-invite." |
| `start_failed` | Any other unexpected error while starting the session | "Interview couldn't start because of a system error." |
| `candidate_disconnected` | Browser grace period expired (`schedule_graceful_end`, `audio_websocket_middleware.rb:~506`) | "Candidate disconnected and didn't return." |
| `ai_connection_lost` | Gemini reconnect attempts exhausted (`handle_gemini_close`, `~:387`) | "Connection to the AI interviewer was lost." |

- **Changed 2026-09-26 after manual QA (Gate B/C):** the assessor sees a short reason, not the full
  validation text: *"Assessment needs fixing (duplicate skills)."* The full text is only logged.
  Codes read "Couldn't start due to a system error." / "Candidate disconnected." / "AI interviewer
  connection lost." Invalid for another reason → "(invalid configuration)".
- **S1-AC11 (added after QA):** the 120s grace period only ends a **running** interview. A session that
  never started stays `pending`, keeps its reason and its invite link (protects D2).
- **S1-AC1**: Given a pending session whose assessment has duplicate skill labels, when the
  candidate connects, then the session records failure code `assessment_invalid`, and the detail
  names the duplicated skill label. *(service/unit spec)*
- **S1-AC2**: Given an active session, when the browser grace period expires, then the session
  ends with `end_reason: error` **and** failure code `candidate_disconnected`. *(unit spec of the
  failure-recording path)*
- **S1-AC3**: Given an active session, when Gemini reconnection is exhausted, then the session
  ends with `end_reason: error` and failure code `ai_connection_lost`. *(unit spec)*
- **S1-AC4**: Given any unexpected exception while starting a session, then failure code
  `start_failed` is recorded, and the raw exception class and message go **only** to the server
  log, never to the stored detail or any API response. *(unit spec)*
- **S1-AC5**: `GET /assessments/:id/sessions`, `GET /sessions/:id`, and the assessment's
  `latest_session` include the failure code and assessor-facing message for failed sessions,
  and `null` for non-failed ones. *(request spec)*
- **S1-AC6**: The invite page's session row shows **"Failed · <assessor message>"** instead of
  the bare "Failed". A session with `end_reason: error` and **no** recorded code (legacy data,
  for example session 1) shows **"Failed · reason not recorded"**, and doesn't crash or show
  blank text. *(component test)*
- **S1-AC7 (idempotent)**: Given a start failure that repeats (the candidate retries 5 times),
  then the session holds **one** current failure reason (the latest), not 5 records, and the
  assessor sees one message. *(unit spec; the exact form depends on D1)*
- **S1-AC8 (upgrade path)**: Given a session that ended `error` and is later upgraded to
  `manual_candidate`/`manual_assessor` by `EndHandler` (existing behavior,
  `end_handler.rb:15-21`), then the failure reason is cleared, so the UI doesn't show both
  "Completed" and a failure reason. *(unit spec)*
- **S1-AC9 (depends on D2)**: Given a start failure of type `assessment_invalid`, then the
  session either **stays retryable** (still `pending`, so the candidate can use the same link
  once the assessor fixes the assessment) **or** becomes terminal. Pick one in D2, and the test
  asserts the chosen behavior.

## 3. Story S2: the candidate gets a clear, final message instead of an endless reconnect loop

- **S2-AC1**: Given the session can't start (any S1 start code), when the server handles the
  failed WebSocket open, then it sends
  `{ type: "error", code: <code>, recoverable: false, message: <candidate-safe text> }`
  **before** closing, instead of the current silent close (`audio_websocket_middleware.rb:60-62`).
  *(unit spec of the message builder / handler)*
- **S2-AC2**: Candidate-safe text contains **no** internal details (no skill names, no
  exception text, no "duplicate", no ids). It tells the candidate what to do:
  *"This interview can't start right now. Please contact the person who invited you."*
  *(unit spec asserting the exact allowlisted strings)*
- **S2-AC3**: Given the browser receives `error` with `recoverable: false`, when the socket then
  closes, the client **does not reconnect**. Today it does, because `sessionEndedRef` is never
  set on that path (`useAudioWebSocket.ts:106-107` → `onclose` reconnects at `:118-122`).
  *(hook test with a mock WebSocket: exactly 1 connection attempt)*
- **S2-AC4**: The interview page shows the server's candidate message in a final error state
  with no "Reconnecting…" banner, no spinner, and no "Force reconnect" button. *(component test)*
- **S2-AC5 (regression)**: A **recoverable** drop (a network blip, `onclose` without a prior
  non-recoverable error) still reconnects with the existing backoff. *(hook test)*

## 4. Story S3: reject duplicate skills, and make removing a skill actually work

- **S3-AC1**: Given a new assessment with two skills whose labels match after **trimming and
  case-folding** ("RESTful API Design" vs " restful api design"), when it's submitted, then the
  response is **422** with a message naming the duplicated label, and **nothing is saved**
  (no assessment and no skills). *(model spec + request spec)*
- **S3-AC2**: Duplicates are detected **within the same request's nested attributes**, not
  only against rows already in the DB. (Known Rails pitfall: a plain
  `validates :skill_label, uniqueness: { scope: :assessment_id }` misses duplicates that are
  both unsaved in the same request.) *(model spec, written first so it goes red on the naive
  version)*
- **S3-AC3**: Given an existing assessment, when an update **adds** a skill whose label matches
  an existing one, then 422, and the stored assessment is unchanged (including scalar fields
  like `time_limit_min` sent in the same request). *(request spec)*
- **S3-AC4**: Given an existing assessment **with legacy duplicates** (like assessment 2), when
  an update marks one duplicate `_destroy: true`, then it's accepted (200) and afterwards has
  no duplicates. Skills marked for destruction don't count toward uniqueness. *(model spec)*
- **S3-AC5**: A taxonomy skill and a custom skill with the same label count as duplicates,
  because the interview's coverage map is keyed by label (`schema.rb:80`). *(model spec)*
- **S3-AC6 (the finding-5 fix)**: When the assessor removes a **saved** skill in the Edit page
  and saves, the request includes `{ id: <id>, _destroy: true }` for it. When they remove a
  **not-yet-saved** skill, it's just omitted. After reloading, the removed skill is gone.
  *(unit test of the payload builder + request spec)*
- **S3-AC7**: When the server returns 422, the create/edit form shows the server's message and
  **keeps everything the assessor typed**. *(component test)*
- **S3-AC8 (non-goal made explicit)**: No change to the create flow for valid assessments:
  distinct labels still save exactly as before. *(request spec, regression)*

## 5. Story S4 (stretch): tell temporary AI failures apart from permanent ones

Only if S1-S3 are done, tested, and reviewed by **Sat 26 midday**.

- **S4-AC1**: Portfolio generation failures are classified as **temporary** (HTTP 429, 5xx,
  timeout) or **permanent** (other 4xx, for example 404 model not found), and the class is
  stored with the existing `generation_error`. *(unit spec on the classifier)*
- **S4-AC2**: The portfolio page shows the reason instead of just "Portfolio generation
  failed." For temporary failures: *"The AI service was busy. Try again in a minute."* For
  permanent ones: *"The AI service rejected the request. This needs a configuration fix."*
  Retry stays available in both cases. *(component test)*
- **S4-AC3 (regression)**: The existing guard is unchanged: regenerate is allowed only from
  `failed`, and returns 422 otherwise. *(request spec)*

---

## 5b. Story UX: polish the new states (added 2026-09-26 night, from Gate A feedback)

My conditions: match the existing design language and colors; no performance cost
(CSS-only motion of ~200 ms via the existing tailwindcss-animate, `motion-safe:` only, lucide icons
already installed, no new dependencies, nothing looping).

- **UX-AC1:** When saving an assessment fails (Create **or** Edit, server 422 or a client-side check),
  the message appears in an alert **pinned in view below the header** (`role="alert"`, warning icon,
  destructive color). The assessor doesn't have to scroll to the bottom of a long form to find it.
  *(component + page tests)*
- **UX-AC2:** The alert has a **Dismiss (✕)** button that hides it. A new failed save shows it again.
  What the assessor typed is kept (S3-AC7 still holds). *(tests)*
- **UX-AC3:** Long messages wrap inside the alert and never overflow the viewport (`break-words`,
  `max-w`, side padding on mobile). *(manual QA at 375px)*
- **UX-AC4:** Under "Skills to assess", Create and Edit both show a calm tip: each skill needs its own
  name, and names that differ only in capitals or spaces count as the same skill. *(page tests)*
- **UX-AC5:** The candidate's "Interview unavailable" screen shows an icon, title and message,
  matching the existing "Interview Complete" layout. The S2 tests still pass. *(test + manual QA)*
- **UX-AC6:** On the invite page, the reason line has a small icon and wraps long text without
  pushing the status badge off-screen on mobile. *(manual QA at 375px)*
- **UX-AC7:** No motion for users with reduced-motion enabled (`motion-safe:`); icons are
  `aria-hidden`, and the text carries the meaning. *(code review)*

## 5c. Story DL: sessions never stay "Live" forever (added 2026-09-27, from Gate E)

Evidence: session 3 was `active` for 48.5 h on a 10-minute assessment. Every way a session ends lived in
the Rails process's memory (grace timer, time checks on candidate turns), so each restart orphaned it.

- **DL-AC1:** When a session starts, a deadline job is scheduled for `started_at + time limit + 5 min`.
  It's stored by Sidekiq in Redis, so it survives Rails restarts and deploys. *(StartHandler spec)*
- **DL-AC2:** When the deadline passes and the session is still `active`:
  - if the candidate said anything (candidate transcript turns exist) → end with `time_ceiling`
    (a normal end, shown as "Completed", portfolio generated);
  - if not → end with `error` + `candidate_disconnected` (shown as "Failed · Candidate disconnected.").
  *(worker spec)*
- **DL-AC3:** The job does nothing to sessions that are pending, already ended, or not yet overdue, so
  running it twice or early is safe. *(worker spec)*
- **DL-AC4:** An operational sweep ends every overdue active session, for rows orphaned before this fix
  (`rails sessions:end_overdue`). *(worker spec on the sweep method)*
- **DL-AC5:** When a candidate reopens the link of a session that ended in `error`, the page shows the
  failed screen with a generic, honest message, not "Interview Complete". No internal detail.
  *(request spec + page test)*

## 6. Open decisions (resolve in the options comparison, before code)

- **D1: where the failure reason lives.** (a) new columns on `sessions` (`failure_code`,
  `failure_detail`, `failed_at`); (b) a `session_events` table (an audit trail, but S1-AC7 needs
  dedupe); (c) extend the existing `end_reason` Postgres **enum** with finer values (no new
  column, but `ALTER TYPE … ADD VALUE` migrations, and it can't represent "failed but still
  retryable" from D2).
- **D2: is a start failure terminal?** Keeping it `pending` lets the same invite link work once
  the assessment is fixed, but with finding 5 unfixed that was impossible anyway. Marking it
  terminal is simpler, but forces a re-invite.
- **D3: normalization strictness for duplicates.** ✅ **Decided 2026-09-25 (start of S3): `squish` + case-fold** (ignore case and extra spaces).
  Original note: Trim + case-fold (proposed), or also collapse
  internal whitespace (`squish`)? The DB index is an exact match, so anything we catch that it
  wouldn't is extra safety, not a change in meaning.
- **D4: final code names and messages.** The §2 catalog is a proposal.

## 7. Cross-cutting criteria (apply to every story)

- **X-AC1 (UU PDP):** No stored failure detail, API response, test fixture, or new log line
  contains a candidate name, transcript text, invite token, or audio. Test data uses clearly
  fake names ("Test Candidate A"). *(asserted in specs where a detail is built)*
- **X-AC2 (tenant safety):** Failure fields are exposed only through endpoints that are already
  tenant-scoped (`Session` has `tenant_id`, `TenantScoped`). No new unscoped lookup. *(request
  spec: another tenant's session id → 404)*
- **X-AC3 (no silent swallow):** Every new `rescue` either records a failure reason or logs
  with the session id, never both-nothing. *(code review checklist + unit specs)*
- **X-AC4:** Existing behavior not in scope stays unchanged: the audio pipeline, speed test,
  scoring, fit-gap.

## 8. Test plan and proof points

| Layer | Tooling | Covers |
|---|---|---|
| Backend | RSpec (gems already in Gemfile; set up with `rails g rspec:install`), FactoryBot | S1, S2-AC1/2, S3-AC1-6, S4-AC1/3, X-AC1/2 |
| Frontend | Vitest + React Testing Library (not installed) | S1-AC6, S2-AC3/4/5, S3-AC6/7, S4-AC2 |
| Not automated (and why) | A full browser↔Faye↔Gemini WebSocket integration test | Too costly in the time left. The failure logic is extracted into plain Ruby objects so it can be unit tested. Stated as a limitation in the report. |

- **Seeded-fault candidate:** remove the case-folding from duplicate detection → **S3-AC1**
  goes red. Or remove the `sessionEndedRef` fix → **S2-AC3** goes red. Do it on a scratch
  branch, show the red run, revert, and keep the history.
- **AI verification moment (already happened, genuine):** Claude recommended `gemini-2.5-pro`
  from the ListModels output. The API rejected it ("no longer available to new users"), and it
  was caught during the Retry test (see `report.md`, AI verification moments).

## 9. Out of scope (goes in the report, not the PR)

"Not assessed" scoring for empty transcripts (finding 8), the candidate audio loss (finding 6),
the speed-test check (finding 1), the hard-coded API `v1` (finding 4), cross-tenant IDOR
(unverified), duplicate-invite / email, and the unused `failed` session status (documented, not
changed, to avoid widening scope).
