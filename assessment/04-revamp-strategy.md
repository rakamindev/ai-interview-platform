# Step 4: Revamp Strategy, Acceptance Criteria & Trade-offs

## What we're fixing, in order

Straight from Step 3's findings, cheapest/highest-impact first. No new problems added.

| # | Problem (from Step 3) | Severity | Scope this cycle |
|---|---|---|---|
| 1 | Fabricated skill scores | Internal + Candidate P0 | Implemented |
| 2 | No role separation | Internal P0 | Designed, deferred |
| 3 | Completion screen always says success | Candidate P0 | Implemented |
| 4 | No exit guard (silent exit, no continue/end choice) | Candidate P0 | Implemented |
| 5 | JSON leak in transcript | Internal/Candidate P2 | Implemented |
| 6 | No data delete/retention path | Internal + Candidate P1 | Designed, deferred |
| 7 | Vacancy has no employment type / deadline | Internal P3 | Designed, deferred |

Items 2, 6, 7 get a chosen direction and trade-off analysis below like everything else — they're just not built this cycle (reasoning in §3).

---

## 1. Acceptance Criteria

Per the brief's 5 required categories, defined before writing code.

**Unassessed skills**
- Skill genuinely discussed (`coverage_map.state` ≠ `not_yet`) → save the real score, like today.
- Skill never discussed (`state == 'not_yet'`) → skip the row entirely. Fit/Gap already reads a missing row as `not_assessed` — no schema change needed.

**Missing / bad ratings**
- Gemini omits `level` or returns something non-numeric on a skill that WAS discussed → treat as a parse failure for that skill only, log it, don't silently coerce to a number.
- Duplicate skill entries in one response → last one wins, no duplicate rows.

**Model call failures**
- Gemini API errors during generation → retry with bounded backoff, then mark `Portfolio.status = failed` with a reason. Never stuck at "generating" forever.
- Interview reconnection fails mid-session → backend already emits `reason: error` correctly (existing code); the gap being closed is the frontend actually using it.

**Edge-case data types**
- `level` as a float or out-of-range int → clamp/round only for skills that were actually discussed; never used to justify inventing a score for one that wasn't.
- Malformed/partial JSON from Gemini → fail that skill's parse, don't crash the whole generation job.

**Long text / streaming states**
- Coverage-tracking JSON split across multiple stream chunks → sanitizer buffers until the object is structurally complete (brace-depth check), regardless of where the split happens. No fragment ever reaches the transcript.
- Completion screen: `end_reason: completed` → success screen; `error` / `timeout` / anything unrecognized → distinct "something went wrong" screen, never the success message.
- Exit dialog: candidate picks "Continue" → stays on screen, timer unaffected; picks "End Interview" → ends normally, not flagged as an accidental error.

**UI polish standard (applies to any screen touched this cycle, not a new scope item)**
- Every state (loading, error, success, empty) is visually distinct and readable at a glance — not just different text.
- Layout holds up on mobile widths, including with long text/errors.
- Interactive elements (buttons, dialogs) have clear visual hierarchy so the right action is obvious under pressure.

---

## 2. Option A vs Option B, per problem

Each option is checked against: **Product Impact vs Cost**, **Maintainability**, **Failure Modes**, and **Contextual Fit** (why it's right for this codebase and deadline).

### 1. Fabricated skill scores
- **Option A (chosen):** Check `coverage_map.state` before saving a skill; skip the row if `not_yet`. Wrap the whole save in a transaction.
  - *Impact vs cost:* Removes fabricated data at the source, zero cost — reuses fields that already exist, no migration.
  - *Maintainability:* One clear invariant ("no row without discussion"), easy for the next engineer to reason about.
  - *Failure modes:* If `coverage_map.state` itself is ever wrong (state not updated in time), a genuinely-discussed skill could be skipped — safe-fail direction, better than the reverse.
  - *Fit:* Matches the exact bug reproduced in Step 3, at the lowest possible cost for a P0 that determines real hiring outcomes.
- **Option B:** Keep defaulting to `1`, add a separate "was discussed" flag next to it.
  - *Impact vs cost:* Cheaper to write, but fixes nothing — any consumer that forgets to check the flag still uses the fake score.
  - *Maintainability:* Pushes correctness onto every future consumer instead of the one producer.
  - *Failure modes:* Silent regression the moment one new caller skips the flag check.
  - *Fit:* Rejected — treats the symptom on a P0 that shouldn't ship with a workaround.

### 2. No role separation *(designed, deferred)*
- **Option A (direction chosen for the design):** Add real `recruiter` / `hiring_manager` roles in the DB, check the correct role per action instead of the blanket check.
  - *Impact vs cost:* Buys real least-privilege; cost is touching authorization in every controller.
  - *Maintainability:* High — adding a role later is one line in a capability matrix, not a new ad-hoc check.
  - *Failure modes:* Changing authorization checks with zero test coverage risks silently over- or under-granting access on a controller that gets missed.
  - *Fit:* Correct long-term direction, but the failure mode above is exactly why it's not executed this cycle — see §3.
- **Option B:** Keep one role, add on/off capability flags per user.
  - *Impact vs cost:* Cheaper, but doesn't create real roles — a patch, not a role model.
  - *Maintainability:* Low — flags drift per-user with no single source of truth.
  - *Failure modes:* Easy to forget to set a flag on a new account, silently over-granting.
  - *Fit:* Rejected as the long-term answer; kept only as a smaller MVP fallback if role work is picked up later under a tighter deadline.

### 3. Completion screen always says success
- **Option A (chosen):** Pass the real `end_reason` from backend to frontend, render a distinct screen per reason.
  - *Impact vs cost:* Fixes the majority-outcome bug (8/12 sessions) at near-zero cost — backend already sends the right data.
  - *Maintainability:* Adding a future end-state is one more branch in an explicit switch.
  - *Failure modes:* An unrecognized future `end_reason` must default to the error screen, never silently to success (captured in AC above).
  - *Fit:* Cheapest, highest-frequency fix in the whole report — clear priority for this cycle.
- **Option B:** Reduce how often sessions end in error (tune Gemini reconnection retries).
  - *Impact vs cost:* Doesn't fix the lying screen for sessions that still fail; can't even be verified live right now (Gemini key issue).
  - *Maintainability:* Reasonable, but it's a mitigation, not a correctness fix.
  - *Failure modes:* More retries can mean a longer hang before any resolution.
  - *Fit:* Complementary follow-up once the Gemini key is fixed and verifiable — not a substitute for A.

### 4. No exit guard
- **Option A (chosen):** Intercept navigation attempts with a confirmation dialog — **Continue Interview** or **End Interview** — instead of exiting silently.
  - *Impact vs cost:* Directly fixes the confirmed bug (back button exits with no warning); small, contained frontend change.
  - *Maintainability:* Self-contained component, easy to extend later (e.g. add a countdown before auto-continue).
  - *Failure modes:* Must still fire on all exit paths (back button, tab close, route change) — missing one path reopens the bug.
  - *Fit:* Matches the actual gap identified in Step 3 (no confirmation, no choice) without requiring session-state restore.
- **Option B:** Full resume — candidate leaves and later reopens the link to continue exactly where they left off.
  - *Impact vs cost:* Solves a bigger problem (recovering after already leaving) at a much bigger cost — session-state restore, timer handling.
  - *Maintainability:* More moving parts (persisted progress, resumable timer) to keep correct over time.
  - *Failure modes:* Restoring stale or partial state incorrectly could itself corrupt a session.
  - *Fit:* Right idea, wrong sprint — noted as future work, not required to close this cycle's P0.

### 5. JSON leak in transcript
- **Option A (chosen):** Fix the sanitizer to track whether the JSON is structurally complete (brace counting), instead of only checking if it starts with `{`.
  - *Impact vs cost:* Closes the confirmed-live leak with a contained change to one method.
  - *Maintainability:* Slightly more logic in one function, covered by a unit test using the exact reproduced fragment from Step 3.
  - *Failure modes:* Must cap how long it buffers an incomplete object, or a payload that never completes could swallow real text.
  - *Fit:* Right severity-to-effort ratio for a P2.
- **Option B:** Redesign how Gemini sends tracking data so it's never mixed with transcript text at all.
  - *Impact vs cost:* Structurally correct, but a bigger change to the Gemini integration than a P2 justifies now.
  - *Maintainability:* Cleaner long-term, but larger surface area to maintain.
  - *Failure modes:* Touches the prompt/response contract — higher risk of unrelated regressions.
  - *Fit:* Right answer, wrong sprint — noted as an architectural follow-up.

### 6. No data delete/retention path *(designed, deferred)*
- **Option A (direction chosen for the design):** Soft-delete — mark records deleted, scrub personal info, exclude from all reads.
  - *Impact vs cost:* Satisfies the UU PDP request path without touching the broken FK found in Step 3.
  - *Maintainability:* Well-understood Rails pattern (scoped default).
  - *Failure modes:* Every read path must respect the exclusion scope, or "deleted" data resurfaces.
  - *Fit:* Lowest-risk way to close this gap given the existing FK issue.
- **Option B:** Hard delete, fixing the broken FK first.
  - *Impact vs cost:* More complete data-minimization, but requires a schema change to a relationship that currently throws an unhandled FK violation.
  - *Maintainability:* Fine once done, but a one-time migration risk.
  - *Failure modes:* A bad migration on an already-broken relationship risks breaking existing records — the kind of thing the brief flags as a disqualifier if handled carelessly.
  - *Fit:* Revisit once the FK relationship is fixed as its own tracked item — not this cycle.

### 7. Vacancy has no employment type / deadline *(designed, deferred)*
- **Option A (direction chosen for the design):** Add `employment_type` (enum) and `deadline` (date), required on the form, validated on save.
  - *Impact vs cost:* Closes a real gap (candidates uninformed, recruiters can't close postings) for the cost of one migration + one form update.
  - *Maintainability:* Simple, standard Rails validation.
  - *Failure modes:* None significant — additive schema change.
  - *Fit:* Correct fix, just lowest priority (P3, no confirmed live harm) relative to the four items actually shipped this cycle.
- **Option B:** Add the fields as optional free-text, no validation.
  - *Impact vs cost:* Cheaper, but doesn't solve the actual problem if recruiters can leave it blank.
  - *Maintainability:* Low — inconsistent data with no enforced shape.
  - *Failure modes:* Silently reverts to today's gap the moment a field is skipped.
  - *Fit:* Rejected — doesn't meaningfully close the gap it's meant to close.

---

## 3. Frontend vs backend balance, and why items 2/6/7 are design-only

Backend gets the deeper implemented work (scoring fix) and the deepest *design* work (role model), since that's where the compounding P0s are. Frontend isn't skipped: completion screen fix and exit guard are both real, working changes covering success/error/loading states.

Items 2, 6, and 7 get a full option comparison and a chosen direction above, same as everything implemented — they're deliberately not executed this cycle because:
- **Role model (#2):** changing authorization across every controller with no existing test suite is the single highest-risk change in this report. Shipping it half-tested risks creating a new security gap while trying to fix one.
- **Data retention (#6):** no live incident yet, and touches the same fragile FK relationship flagged in Step 3 — safer to land once that's addressed on its own.
- **Vacancy fields (#7):** lowest severity (P3) of all seven findings, no confirmed harm — correctly last in line under this deadline.

This is a scoping decision, not an omission: the brief asks for direction and trade-offs to be defined for the revamp, not for every finding to be implemented in one pass.
