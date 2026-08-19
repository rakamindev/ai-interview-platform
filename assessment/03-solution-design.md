# Phase 4 — Ideal Condition, Acceptance Criteria & Solution Options

## 1. Ideal product condition (for the selected problem)

> **Every ended interview session converges to a `complete` portfolio — or a clearly `failed` one with a recovery path — within a bounded time; transient pipeline failures self-heal automatically; the assessor UI always shows an honest, actionable state.**

Current condition vs ideal condition in brief:

| Stage | Today | Ideal |
|---|---|---|
| Session ends | `EndHandler`: session→`ended`, portfolio created, job enqueued after commit (lossy). | Termination serialized & idempotent; job enqueued reliably; enqueue loss is recoverable. |
| Generation runs | One job may crash mid-run → stuck `generating`; skills rewritten non-atomically. | State machine is crash-safe; skill writes atomic; dedup prevents double Gemini runs. |
| Generation lost | `show` returns `generating` forever; nothing retries. | Stuck states self-heal on read + a sweep; `failed` is honest with a visible reason. |
| UI | Spinner forever; generic error; no empty state. | Bounded messaging, retry action, error detail, empty state. |

**Why this matters:** the portfolio is the deliverable hiring decisions are made on. Every day a portfolio is stuck is a candidate silently un-evaluated and a recruiter stalled — direct product-value and trust loss.

## 2. Acceptance criteria

**Normal behavior**
- AC1: Ending a session creates exactly one portfolio and enqueues exactly one generation job.
- AC2: A second end call is a no-op (returns the ended session, no new job).
- AC3: Successful generation → portfolio `complete`, skills present, `generated_at` set.

**Missing data / partial state**
- AC4: `GET /sessions/:id/portfolio` on an ended session with `nil` portfolio creates a `pending` portfolio and enqueues generation (self-heal).
- AC5: `GET /sessions/:id/portfolio` on a `pending` portfolio beyond TTL re-enqueues generation.
- AC6: `GET /sessions/:id/portfolio` on a `generating` portfolio older than TTL resets to `pending` and re-enqueues.
- AC7: A fresh `generating` portfolio (< TTL) is left untouched.

**Invalid/stuck states**
- AC8: `regenerate` is allowed for `pending`, `generating`, and `failed`; rejected with 422 when `complete`.
- AC9: A portfolio stuck in `generating` with skills half-written does not lose skills on a re-run (atomic rewrite).

**AI/model failures**
- AC10: Gemini failure → portfolio `failed` with readable `generation_error`; retry allowed.
- AC11: Worker never succeeding does not cause unbounded re-enqueues (only pending/generating beyond TTL are re-enqueued; failed is terminal until user action).

**API / concurrency**
- AC12: Two concurrent end calls → exactly one portfolio created, exactly one job enqueued, no 500.
- AC13: Enqueue failure (Redis down) at end time does not return 500 and remains recoverable.

**UI/UX**
- AC14: While generating < TTL, the page shows the current generating state.
- AC15: After a timeout budget, the page shows "taking longer than expected" + a working **Retry generation** action.
- AC16: `failed` state displays the backend `generation_error` and a retry.
- AC17: Empty/failed fetch states are distinct and actionable.

## 3. Solution options considered

### Option A — Self-healing lifecycle + recovery sweep (SELECTED)
- **Architecture:** Keep the existing event/worker model; add a row-lock (`with_lock`) around session-end for serialization; make the generator a locked state machine with atomic skill writes; add a `Portfolios::Recovery` service (single-record heal on API read + a rake-task sweep), a `generation_started_at` column for a precise TTL, and allow regenerate from any non-complete state. Frontend: bounded polling + time-aware states + error detail.
- **Backend changes:** `EndHandler` (lock, idempotency, rescue enqueue), `Generator` (dedup lock, atomic save, started_at), new `Recovery` service + rake task, controller `show`/`regenerate` updates, migration.
- **Frontend changes:** `PortfolioPage` states + retry.
- **Database changes:** 1 reversible migration (`generation_started_at`).
- **Testing:** RSpec for handlers/generator/recovery/controller; vitest for page states.
- **Product impact:** High — core deliverable protected.
- **Development cost:** Medium.
- **Maintainability:** High (small, well-named units).
- **Failure modes:** Cheaply bounded — worst case a stuck portfolio is healed on next read.
- **Reversibility:** Fully reversible (migration is reversible; behavior additive).
- **Future extensibility:** Recovery is the hook for heartbeat/watchdog monitoring later.
- **Trade-offs:** Slight "side-effect on GET" (self-heal) — documented, idempotent.

### Option B — Dedicated background supervision (watchdog worker + heartbeat)
- **Architecture:** Add a periodic Sidekiq job that scans for stuck portfolios using an updated_at heartbeat written by the generator every N seconds; plus unique-jobs plugin for enqueue dedup.
- **Changes:** + a `sidekiq-cron`-style scheduled job, dedicated high-frequency scans, plus `sidekiq-unique-jobs` gem.
- **Trade-offs:** More moving parts and new dependencies; heartbeat frequency tuning; still needs the same frontend state work. Higher cost, marginally better liveness for *actively running* generation — which the model's own timeout (3 min) already bounds.
- **Why not:** New gems + scheduling infra for a margin we do not need; the single-read self-heal + rake sweep covers the failure envelope.

### Option C — Frontend-only mitigation
- **Architecture:** Only change `PortfolioPage` to stop showing an endless spinner and tell the user to contact support / try again.
- **Trade-offs:** Cheapest, but the product's data is still stranded; "try again" can't fix a `generating` state (regenerate rejects non-`failed`). Not honest engineering.

## 4. Trade-off matrix

| Criterion | A (self-heal) | B (watchdog) | C (frontend-only) |
|---|---|---|---|
| Product value recovered | High | High | Low |
| Complexity / new deps | Low–Med / none | Med–High / 2 gems | Low |
| Data correctness guarantees | High | High | None |
| Frontend UX honesty | High | High | Med |
| Testability | High | Med | Med |
| Reversibility | High | Med | High |
| Risk of over-engineering | Low | Med | — |

## 5. Selected approach & justification

**Option A.**

- Matches the current repo architecture (workers + services, no scheduler, no unique-jobs gem) — adding a scheduler/dependency (B) contradicts the stated focus ("don't introduce unnecessary libraries").
- Fixes both P1-01 and root-cause P1-02 with the smallest, most testable unit set.
- Uses the existing post-endpoint read path so the *assessor who looks* always triggers a heal — no infra changes required to ship; the rake sweep is the ops safety net.
- Frontend work is a genuine UX upgrade (honest, actionable states), not a workaround.
- Reversible and additive: a `pending`/`generating` recovery never destroys data, and `regenerate` widening is backwards-compatible (previously rejected states become retryable).

Rejected: B (over-engineering for this deadline), C (does not fix the data problem).