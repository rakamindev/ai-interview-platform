# AI Interview Platform - Revamp Report & Execution Narrative

## 1. Product Context Analysis
**The Product & Industry:**
The platform aims to automate candidate screening via AI, operating in the Indonesian hiring market. While basic AI screening is becoming commoditized, the real leverage sits in providing deep, nuanced skill analysis that assessors can trust over a simple LLM summary.

**Users & Candidates:**
- **Users (Assessors/Recruiters):** Need reliable, transparent data to make hiring decisions quickly without watching full interview recordings.
- **Candidates (The Assessed):** Subjected to automated evaluation without opting in. They require fair, unbiased, and legally compliant handling of their data.
- **UU PDP (Personal Data Protection) Implications:** The system processes voice and behavioral data. We must ensure no sensitive personal data is leaked in logs, commits, or unsecured endpoints, and that all data processing complies with UU PDP principles (lawful basis, purpose limitation, and data minimization).

## 2. Severity-Ranked Problem & Gap Analysis

| Severity | Component | Problem & First Principles Truth | Impact & Constraint Signal |
| :--- | :--- | :--- | :--- |
| **P0** | API / WebSocket | **Audio Thread Blocking:** In a live interview, audio continuity is sacred. `audio_websocket_middleware.rb` spawns raw `Thread.new` blocks for DB writes on every chunk, mixing memory-bound streaming with I/O-bound disk writes. | **Impact:** High concurrency saturates the DB connection pool, causing audio stutter or drops for the candidate. <br>**Signal:** Architectural debt; requires decoupling via an async worker queue (Sidekiq). |
| **P0** | API / DB | **Silent Error Swallowing:** `save_transcript_turn` rescues `RecordNotUnique` silently. | **Impact:** Data loss during race conditions. Valid transcripts are silently dropped. |
| **P1** | Security | **Token Leakage:** WebSocket auth uses `?token=...` in the query string. | **Impact:** Exposes JWTs in plain text via standard server (Nginx/ALB) access logs. |
| **P1** | Web / Audio | **Client-Side Audio Volatility (Network Drops):** The frontend assumes perfect network stability. When a candidate's WebSocket connection drops, unacknowledged audio chunks are instantly lost in memory. | **Impact:** Candidates are unfairly penalized for standard Indonesian internet fluctuations. Loss of interview data.<br>**Signal:** Requires client-side graceful degradation (e.g., IndexedDB buffer to stash chunks and bulk-flush upon reconnection). |
| **P1** | Web / Tooling | **Zero Automated Tests & Linting:** The frontend lacks testing harnesses and strict type-checking. | **Impact:** Impossible to verify complex React state automatically. High risk of regression. |
| **P1** | API / FitGap | **Report History Loss & Regeneration Races:** `FitGap::Engine` overwrote a single report row on every regeneration, so an assessor override destroyed the prior snapshot with no audit trail. The frontend's 404-driven polling (report row doesn't exist yet mid-generation) re-fired generation on every 5s tick with no in-flight guard, racing multiple workers against the same row. A field-name mismatch (`expected_level` vs. `required_level`) also left the "Required" column blank in the Comparison Table. | **Impact:** Assessors lose the ability to see how a Fit/Gap verdict changed after an override; concurrent generations corrupt/duplicate report state; a visibly broken column undermines trust in the report data. |
| **P2** | AI / Backend | **Flash Bleed (State Lag):** Gemini Flash evaluates overlapping context windows asynchronously. The async update lags behind the real-time live turn injection. | **Impact:** The candidate experiences the AI as "robotic". The AI hallucinates coverage and breaks the human illusion by repeating a probe for a skill the candidate just answered. |
| **P3** | Web / UI | **Missing Edge Cases & Empty States:** No fallback UI for hardware permission rejection or aborted interviews. | **Impact:** Confuses candidates and assessors when non-happy paths occur. |

## 3. Revamp Strategy: Option Evaluation & Trade-off Matrix

**Ideal Condition Map:**
The ideal architecture isolates the streaming WebSocket server into a pure memory-only pipeline. Database writes for telemetry and transcript logs should be treated as non-blocking side effects, decoupled via an asynchronous message worker queue. This ensures audio packets retain high priority regardless of database lock contention.

| Option | What it Buys (Product Value) | What it Costs / Forecloses | Long-term Maintainability |
| :--- | :--- | :--- | :--- |
| **Option A: Sidekiq Queue (Chosen)** | Un-blockable audio buffer stream. Zero jitter or stutter for the candidate. | Adds slight processing latency to the Assessor's Live Monitor view. Introduces eventual consistency to telemetry states. | **High.** Standard Rails paradigm. Scalable using dedicated worker processes. |
| **Option B: Inline Thread Pool (Rejected)** | Real-time updates on the Assessor Dashboard with lower latency. | High risk of thread starvation under scale. Audio packet delivery becomes dependent on database query performance. | **Low.** Fragile architecture that mixes raw memory streaming with disk-bound transactions. |

## 4. Revamp Execution Summary (Completed on This Branch)
1. **Infrastructure Stabilization:** Routed audio-turn transcripts and resumption-token updates through existing `Sidekiq` workers (`TranscriptTurnWriterWorker`, `ResumptionTokenWriterWorker` on a dedicated `transcripts` queue, prioritized above `coverage`) instead of `Thread.new` + `connection_pool.with_connection` on the EventMachine thread. The write path also switched from `create!` + silently-rescued `RecordNotUnique` to an idempotent `upsert`, so a duplicate delivery (Sidekiq retry, replayed frame) overwrites in place instead of dropping the transcript.
   - *Windows Patch:* Implemented a `websocket-client-simple` fallback inside `Gemini::LiveClient` to bypass EventMachine's missing OpenSSL bindings on Windows dev machines, while keeping `faye-websocket` for Linux production.
   - *Dev-environment stability:* Disabled prepared-statement caching in `database.yml` for development — pooled connections were holding query plans against stale OIDs after `db:reset`/volume restarts, causing intermittent `PG::UndefinedTable` errors unrelated to app code.
2. **Frontend Hardening & Upgrades:** Migrated the frontend to **TypeScript 7.0.2** and added an `oxlint` + `oxfmt` lint/format pipeline (Rust-based, replacing the absent ESLint/Prettier setup) plus a `vitest` test runner. Coverage is a first pass, not exhaustive — currently 7 unit tests around the new `SkillPicker` multi-select behavior; broader component/hook coverage is the natural next increment.
3. **Security Patching:** Removed the invite token from the audio WebSocket URL (`?token=...`) on both client and server. The candidate audio connection now authenticates via a post-open `{ type: "auth", token }` message within a 10s timeout — mirroring the pattern `CoverageWebSocketMiddleware` already used for assessors — so no token is ever written to Nginx/ALB access logs or browser history. The pre-existing JWT-header path for assessor connections was left unchanged.
4. **Resiliency & AI Optimization:** Fixed a swallowed `ArgumentError` in `CoverageAnalyzerWorker` (missing `turn_number:` kwarg) that had silently prevented Flash's coverage analysis from ever running. Added a Redis NX lock to serialize per-session analysis runs and a monotonic `coverage_last_turn` watermark so a stale/delayed run can never overwrite fresher state. The audio middleware now refreshes its injected coverage text via a Redis pub/sub confirmation from the analyzer, instead of optimistically refreshing right after enqueueing the write — closing the state-bleed window that caused repeated probes on already-answered skills.
5. **Client-Side Audio Resilience:** Added an IndexedDB-backed `audioChunkQueue` so outgoing audio captured during a WebSocket drop or mid-reconnect flush is buffered locally and bulk-flushed in order once the connection restores, instead of silently discarding frames — directly addressing the "candidate penalized for network fluctuation" risk.
6. **FitGap Data Integrity:** `FitGap::Engine` now creates immutable, timestamped report snapshots (`trigger_reason`: initial/manual/override) instead of overwriting one row, so assessor-override history is preserved and auditable. A Redis NX lock (`enqueue_unless_running`, 120s TTL) keyed on `(portfolio_id, vacancy_id)` makes repeated generation triggers (e.g., poll-driven re-fires) a no-op while a job is in flight. The stale unique DB index that had been silently blocking the “preserve history” intent was dropped in favor of an ordered `generated_at desc` lookup, and the `expected_level`/`required_level` field-name mismatch that left the Comparison Table's Required column blank was corrected. Portfolio generation also produces explicit low-confidence baseline skills when a session has no transcript, so downstream Fit/Gap analysis stays usable instead of erroring out.
7. **UX Edge Cases:** Added distinct recovery UI for hardware permission errors (permission-denied vs. no-device vs. in-use, `HardwarePermissionError.tsx`) and a dedicated aborted-interview screen with retry (`InterviewAborted.tsx`) for candidate-info load failures or unrecoverable WebSocket errors — replacing the prior behavior of silently showing the "complete" success screen on failure.

## 5. Self-Derived Acceptance Criteria & Edge Cases Handled

**Acceptance Criteria for WebSocket/Transcript Stability:**
- **Given** a candidate speaks continuously, **When** audio chunks are received, **Then** the audio is forwarded to Gemini without blocking the EventMachine thread.
- **Given** multiple concurrent users, **When** transcripts are saved, **Then** the database connection pool does not exceed its defined limit.
- **Given** a token is used for authentication, **When** the client connects, **Then** the token is passed via the existing JWT header (assessor connections) or a post-open auth message (candidate invite token), never in the URL query string.
- **Given** an assessor triggers Fit/Gap regeneration after an override, **When** a report already exists for that portfolio/vacancy pair, **Then** the prior snapshot is preserved (not overwritten) and a new immutable snapshot is created with its trigger reason recorded.
- **Given** a Fit/Gap generation is already in flight for a portfolio/vacancy pair, **When** another trigger fires (manual or poll-driven), **Then** the duplicate trigger is a no-op instead of enqueueing a second worker.

**Edge Cases Handled:**
- *Unassessed Skills / Missing Ratings:* Handled empty coverage maps gracefully in the UI.
- *Model Call Failures:* Explicit timeout handling for Gemini API calls, falling back to cached state.
- *Hardware Permission Rejection:* Candidates denying camera/mic access are shown an actionable recovery UI, distinguishing permission-denied, no-device, and device-in-use cases.
- *Interview Abort:* Candidate-info load failures or unrecoverable WebSocket errors route to a dedicated aborted-state screen with a retry action, instead of the "complete" success screen.
- *Audio Continuity Across Network Drops:* Outgoing audio chunks are buffered in IndexedDB while the WebSocket is down and bulk-flushed in order on reconnect.
- *JSONB Data Contract Robustness:* The `evidence` field in PostgreSQL `portfolio_skills` can store varied schema shapes. Added defensive parsing in the frontend React loop (`SkillPortfolioCard.tsx`) to ensure the UI degrades gracefully if the structure diverges from pure strings.
- *Candidate Invitation Failure:* Catches server-side errors on session creation (`AssessmentInvitePage.tsx`) and displays an auto-dismissing toast notification.
- *No-Transcript Portfolio Generation:* Sessions with no transcript still produce explicit low-confidence baseline skills so Fit/Gap analysis doesn't error out downstream.

## 6. Monozukuri: Engineering Depth & User Experience Proof

**Claimed Engineering Depth:** Fullstack (Infrastructure & Frontend Rigor)

**User Experience Proof:** We did not choose to refactor the database write mechanics simply to clean up the backend codebase. We isolated this pipeline because a candidate's focus during an interview is fragile. Moving transcript and resumption-token writes off the EventMachine thread preserves conversational presence, leading to higher quality signal and fairer candidate evaluations. The same fragility principle drove the IndexedDB audio buffer — a candidate should not be penalized for a network blip that has nothing to do with their interview performance. On the assessor side, refining the Skill Picker (batch multi-selection, explicit checkboxes) turns a repetitive chore into a highly efficient workflow, and preserving Fit/Gap report history across overrides means an assessor's decision trail survives regeneration instead of being silently overwritten.
