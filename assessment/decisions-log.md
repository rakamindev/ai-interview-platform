# Decisions log

Decisions made while building the revamp. I paired with an AI assistant (Claude Code): where a
decision was proposed by the assistant, the status says so; every one of them was reviewed commit by
commit, manually QA'd, and accepted by me before it reached the branch.

| ID | Decision | Alternatives rejected | Why | Status |
|---|---|---|---|---|
| D3 | Duplicate labels match ignoring case and extra spaces (`squish.downcase`) | exact match; fuzzy match | Exact lets "same skill, different case" through; fuzzy is a product decision | Mine, 2026-09-25 |
| D6 | Enforce duplicates on the model (`UniqueSkillLabelsValidator`); DB index is a follow-up | DB unique index now; service-layer validation | Invariant, not a context rule; index migration would fail on existing duplicates | Mine, 2026-09-25 |
| D1 | Failure reason = columns on `sessions` (`failure_code` Postgres enum, `failure_detail` ≤255, `failed_at`) | `session_events` table; new `end_reason` values | `end_reason` implies ended (can't express D2) and carries no detail; events table adds tenant-scoping surface and no AC needs history | AI-proposed, reviewed and accepted by me |
| D2 | A failure to **start** keeps the session `pending` (same invite link works after the fix); the reason is cleared on a successful start | terminal via unused `failed` status; terminal via `ended`+`error` | Never the candidate's fault; `ended` path would also create an empty portfolio (session 1) | AI-proposed, reviewed and accepted by me |
| D4 | Codes `assessment_invalid`, `start_failed`, `candidate_disconnected`, `ai_connection_lost`; assessor wording built on the backend (`Session::FAILURE_MESSAGES`); one fixed candidate sentence (`START_FAILED_MESSAGE`) | wording in the frontend; per-code candidate messages | Single source of wording; the candidate learns nothing internal | AI-proposed, reviewed and accepted by me |
| D5 | **Deviation:** no `Sessions::FailureRecorder` service. Instead: `Session#record_failure!` / `#clear_failure!` model methods + a `failure_code:` keyword on the existing `EndHandler`, and a small `fail_session_start` in the middleware | a separate service object | Two tiny writes didn't justify a new class; still plain Ruby and unit-tested; ending with a reason belongs in `EndHandler`'s existing transaction | AI-proposed, reviewed and accepted by me |
| D7 | New frontend state `failed` (final screen "Interview unavailable" + server message) instead of reusing `complete` | reuse `complete` | `complete` tells the candidate the interview was recorded, which is untrue here | AI-proposed, reviewed and accepted by me |
| D8 | Stop mic capture on `failed` | leave capture running | UU PDP: no audio capture without purpose | AI-proposed, reviewed and accepted by me |
| D9 | Reason shown only on the invite page (not the assessment list page) | also the list page | Keep scope tight; list page noted as follow-up | AI-proposed, reviewed and accepted by me |

## Added 2026-09-26 (UX polish + CI; my conditions: match the design language, no performance cost)

| ID | Decision | Alternatives rejected | Why | Status |
|---|---|---|---|---|
| D10 | Save errors in a **pinned, dismissible alert** fixed just below the 56px header (`top-16`, `z-50`), built from existing tokens (`destructive`, `background`, `shadow-lg`, `rounded-lg`) and lucide icons | Toast library (new dependency); modal dialog (blocks the form the user must fix); keep the bottom-of-form line | Visible without scrolling, doesn't block editing, zero dependencies | AI-proposed, reviewed and accepted by me |
| D11 | Motion is CSS-only via the existing `tailwindcss-animate`, wrapped in `motion-safe:` (200ms alert, 300ms unavailable screen) | framer-motion; GIF/Lottie | Measured +0.45 kB JS / +0.14 kB CSS gzipped; reduced-motion users get none | AI-proposed, reviewed and accepted by me |
| D12 | Unique-name tip is static helper text (`Info` icon, muted, xs) on Create and Edit | Live duplicate highlighting per card | Cheap and calm; live highlighting is a good next step | AI-proposed, reviewed and accepted by me |
| D13 | Candidate "Interview unavailable" uses a **muted** icon circle, not red | Destructive red | The candidate did nothing wrong; red reads as blame | AI-proposed, reviewed and accepted by me |
| D14 | CI: GitHub Actions with Postgres 14 + Redis 7 services and a placeholder `SECRET_KEY_BASE`; `npm install` (no lockfile committed, following upstream) | `npm ci` (needs a lockfile); real secrets via repository secrets (unavailable to fork PRs) | Works on the fork and for reviewers without secrets | AI-proposed, reviewed and accepted by me |

## Added 2026-09-27 (follow-ups from manual QA gates D, E and F)

| ID | Decision | Alternatives rejected | Why | Status |
|---|---|---|---|---|
| D10b | **Replaces D10:** the error toast sits bottom-right (full width at the bottom on mobile), opaque `red-50` background, `red-600` accent bar, `CircleX` icon and a "Couldn't save" title | top-center white alert (D10) | My QA feedback: the white alert was easy to miss; the app already uses default-palette status colors (21 places) | Mine |
| D15 | Durable deadline = a per-session Sidekiq scheduled job (time limit + 5 min) set at start; outcome by evidence: candidate spoke → `time_ceiling`, silent → `error`/`candidate_disconnected` | sidekiq-cron sweeper (new gem); heartbeats; always "failed" | No new infrastructure; survives restarts (verified with Rails down); an honest outcome instead of a blanket failure | AI-proposed, accepted by me |
| D16 | Duplicate coverage jobs prevented by an atomic claim on `sessions.last_analyzed_turn` | Redis `SET NX` lock (needs Redis in specs, TTL expiry); Sidekiq Enterprise unique jobs (paid) | Atomic in Postgres; also drops stale out-of-order turns | AI-proposed, accepted by me |
| D17 | The candidate endpoint exposes only `ended_with_error` (a boolean) | exposing `failure_code` / `failure_message` | Public endpoint; the candidate needs honesty, not internals (UU PDP, S2-AC2) | AI-proposed, accepted by me |
| D18 | The cleanup task prints what it ended | silent task | A silent task made "worked" and "never ran" look the same during QA | AI-proposed, accepted by me |
| D19 | Close the cross-tenant P0 by scoping lookups through the tenant-scoped session (`Portfolio.for_tenant`, `PortfolioSkill.for_tenant`) | `tenant_id` columns + backfill now (my first, AI-suggested answer) | No schema change or production data risk; single primary-key lookups (EXPLAIN checked); columns stay as defense in depth | Mine (I questioned the migration) |
