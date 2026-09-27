# Options comparison: failure-reason revamp

Written 2026-09-25, before implementation. Each open decision was then resolved when its story started; the outcome is in `decisions-log.md`.
Resolves the open decisions in `acceptance-criteria.md` §6 (D1-D4), plus two implementation
shape decisions (D5, D6) that came up while checking the code.

Each decision: options → trade-offs → recommendation → what it rules out. The "rules out" part
is what the CTO and Tech Lead are most likely to probe.

---

## D1: Where does the failure reason live?

| | (a) New columns on `sessions` | (b) New `session_events` table | (c) Extend the `end_reason` enum |
|---|---|---|---|
| Shape | `failure_code` (enum), `failure_detail` (string ≤255), `failed_at` | One row per event: `session_id`, `tenant_id`, `code`, `detail`, `created_at` | New values such as `error_assessment_invalid`, `error_ai_lost` |
| S1-AC7 (repeated failure → one reason) | Free: overwrite on each failure | Needs dedupe logic or a unique constraint | Free |
| S1-AC8 (clear on upgrade) | Set 3 columns to nil | Delete or ignore events, and then "current state" becomes a query | Already how the upgrade works |
| D2 "failed but still retryable" | ✅ can be set while `pending` | ✅ | ❌ **`end_reason` implies the session ended**, so it can't express a pending session whose start failed |
| Carries the duplicated skill label (S1-AC1) | ✅ `failure_detail` | ✅ | ❌ an enum value has no payload |
| Read cost on the sessions list | Same query as today | Needs "latest event per session" (subquery/join, N+1 risk) | Same as today |
| Frontend blast radius | Additive fields | Additive, but needs a new endpoint or nesting | **Breaking**: `AssessmentInvitePage.tsx:68` checks `end_reason === "error"`, and every consumer must learn the new values |
| Tenant safety | Inherits `sessions.tenant_id` | Must carry its own `tenant_id` and scope. That's exactly the gap that makes Portfolio/FitGap suspect (IDOR lead) | Inherits |
| History / audit trail | Latest only | ✅ full history | Latest only |
| Size in ~1.5 days | Small | Medium-large | Small, but can't meet D2 or S1-AC1 |

**Recommendation: (a) columns on `sessions`.** It meets every AC with the least new surface.
(c) is ruled out on correctness grounds, not size: it can't represent a pending session whose
start failed, and it can't carry the duplicated label. (b) is the right shape if history were
a requirement, but no AC needs history. It would also add a new table that has to get tenant
scoping exactly right, which is the class of bug we already suspect elsewhere.

**Sub-choice: `failure_code` as a Postgres enum vs a string with a Ruby inclusion validation.**
The repo's convention is Postgres enums for every status-like column (7 in `schema.rb:20-26`),
and `context.md` says to follow repo conventions. Recommendation: **a Postgres enum
`session_failure_code`**, for DB-level integrity and consistency. Cost accepted: adding a new
code later needs a migration, which the repo already does routinely (for example
`20260411000000_add_10_min_to_time_limit_options.rb`).

**Rules out:** failure history (only the latest reason is kept). It's stated in the report as
a known limit. The path forward is (b) if support needs a timeline.

---

## D2: Is a failure to *start* the interview terminal?

(Mid-interview failures, `candidate_disconnected` and `ai_connection_lost`, stay terminal:
`ended` + `end_reason: error`, as today. D2 is only about failing **before** the interview
starts: `assessment_invalid`, `start_failed`.)

| | (a) Terminal, via the unused `status: failed` | (b) Stay `pending` + record the reason (retryable) | (c) Terminal, via `ended` + `end_reason: error` |
|---|---|---|---|
| Candidate after the assessor fixes the assessment | Dead link, needs a new invite | **Same link works** | Dead link |
| Whose fault the failure usually is | Assessor config or platform, never the candidate | same | same |
| Uses existing plumbing | Gives the unused `failed` status its first real use. `authenticate_and_load` (`audio_websocket_middleware.rb`) only rejects `ended`, so it would need a new check | `authenticate_and_load` already lets `pending` through. No new state | Must **not** go through `EndHandler`, which creates a portfolio and queues AI scoring for a session that never started (what happened to session 1, finding 3) |
| New UI state | "Failed" (a new status value to render) | **"Couldn't start · reason"** on a pending row | Existing "Failed" |
| Risk | Low | Low-medium: needs a clear rule for when the reason is cleared (on successful start) | Medium: easy to accidentally trigger the empty-portfolio path |

**Recommendation: (b), stay pending and retryable.** The failure is never the candidate's
fault, and a candidate who never chose to be assessed by this system shouldn't have to wait for
a re-invite because of the assessor's configuration. It only became possible with S3 in scope,
because before the finding-5 fix, a broken assessment couldn't be repaired at all. The
recorded reason is **cleared when the session later starts successfully** (add as **S1-AC10**).

**Rules out:** the invite page can no longer assume "pending = nothing happened yet". It must
show "Couldn't start · reason" when a failure code is present. That new state is covered by
S1-AC6. The unused `failed` status stays unused (documented in the report, not changed).

---

## D3: How strict is duplicate-skill matching?

| | (a) Exact match | (b) Trim + case-fold | (c) `squish` + case-fold (also collapses inner spaces) |
|---|---|---|---|
| Matches the DB constraint that actually breaks (`coverage_maps(session_id, skill_label)`, exact) | Exactly | Stricter | Stricter |
| Catches "RESTful API Design" vs "restful api design" | ❌ | ✅ | ✅ |
| Catches "Ruby  on Rails" (double space) | ❌ | ❌ | ✅ |

**Recommendation: (c).** Exact matching (a) would technically stop the crash, but it would let
through what a human clearly reads as the same skill, and the AI would then be told to assess
the same thing twice. The cost is one `squish.downcase`. Rejecting "near-duplicates" beyond
that (for example "REST API design" vs "RESTful API Design") is **ruled out**: that's fuzzy
matching and a product decision, not a correctness fix.

---

## D4: Code names and messages

Keep the `acceptance-criteria.md` §2 catalog as is: `assessment_invalid`, `start_failed`,
`candidate_disconnected`, `ai_connection_lost`. Assessor-facing messages are built from the code
on the backend (single source), so the frontend only renders them. The candidate-facing text is
**one fixed, allowlisted string** for all start failures (S2-AC2), so the candidate learns
nothing internal.

---

## D5: Where does the failure logic go? (implementation shape)

| | (a) Inline in `AudioWebSocketMiddleware` | (b) Extract `Sessions::FailureRecorder` |
|---|---|---|
| Testability | The middleware is a ~770-line Rack/EventMachine/Faye object. Unit testing it means faking all of that | Plain Ruby object: `FailureRecorder.new(session).call(code:, detail:)`. Trivial to spec |
| Repo convention | — | Matches the existing `Sessions::StartHandler` / `Sessions::EndHandler` service pattern |
| Middleware change | Large | Three small call sites plus the error frame |

**Recommendation: (b).** It's what makes the "no WebSocket integration test" limitation (AC §8)
acceptable: the logic is proven by unit specs, and the middleware only wires it in.

---

## D6: How are duplicates enforced?

| | (a) Model validation on `Assessment`, over the in-memory `assessment_skills` | (b) DB unique index on `assessment_skills(assessment_id, lower(skill_label))` | (c) Both |
|---|---|---|---|
| Sees two unsaved skills in the same request (S3-AC2) | ✅ (iterates the in-memory collection, skipping `marked_for_destruction?`) | ✅ at insert time, but surfaces as `RecordNotUnique` → **500** unless rescued | ✅ |
| Friendly 422 with the label | ✅ | ❌ without extra rescue code | ✅ |
| Race safety (two concurrent saves) | ❌ theoretical gap | ✅ | ✅ |
| **Migration against existing data** | None | **Fails if any legacy duplicates exist**, as assessment 2 has locally, and production likely does too. That needs a data cleanup migration first | Same problem |

**Recommendation: (a) now, (b) as a documented follow-up.** Concurrent edits to one assessment
by two assessors are unlikely, while a migration that fails on real data during deploy is a
concrete risk. Adding the index safely means a cleanup step first, which is out of scope and
is written up in the report as the next step.

---

## Summary

| Decision | Recommended option |
|---|---|
| D1 storage | Columns on `sessions`, `failure_code` as a Postgres enum |
| D2 start failure | Stay `pending`, retryable, cleared on successful start (new S1-AC10) |
| D3 matching | `squish` + case-fold |
| D4 codes | As in the AC catalog. Backend builds assessor messages. One fixed candidate string |
| D5 shape | `Sessions::FailureRecorder` service |
| D6 enforcement | Model validation now. DB index is a follow-up (legacy-data migration risk) |
