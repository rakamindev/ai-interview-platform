# AI Interview Platform: making interview failures visible and actionable

**Candidate:** Daffa Pradana · **Role:** Fullstack Product Engineer (Backend depth)
**Pull request:** [rakamindev/ai-interview-platform#148](https://github.com/rakamindev/ai-interview-platform/pull/148) (Option A, single PR from `daffa-pradana:feat/interview-failure-visibility` into `rakamindev:main`)
**Seeded-fault branch:** [scratch/seeded-fault-duplicate-skills](https://github.com/daffa-pradana/ai-interview-platform/tree/scratch/seeded-fault-duplicate-skills)
**Video:** [Loom walkthrough](https://www.loom.com/share/ac5d668f2877449a973838cfa7d9560d)

> Every claim below maps to a commit, a test, a screenshot or a log line.

---

## 0. Summary

I used the platform end to end as an assessor and as a candidate. The most damaging problem I found was not a single bug but a pattern: **when an interview fails, nobody can tell.** A candidate is stuck in an endless "Reconnecting…" loop or is told *"Interview Complete, the interview has been recorded"* when nothing was recorded. The assessor sees a red "Failed" with no reason, or a session that stays "Awaiting candidate". The real cause only exists in the server log.

I traced one concrete path to the root: an assessment form that accepts the same skill twice, which crashes every interview for that assessment on a database unique index, 107 reconnect attempts in 2 minutes, silently.

The revamp, across `api/` and `web/`:

1. **Prevent it**: duplicate skills are rejected (case and spacing insensitive), and removing a skill in the Edit page now actually removes it (it silently did nothing before).
2. **Explain it**: every failed interview records *why* (four codes) and the assessor sees a short, actionable reason, for example *"Couldn't start · Assessment needs fixing (duplicate skills)."*
3. **Recover from it**: a failure to start keeps the invite link valid, so after the assessor fixes the assessment the **same link works**. The candidate sees one honest, final message, no reconnect loop, and their microphone is released.

4. **Never leave it hanging**: every interview gets a durable deadline that survives server restarts, so a session can no longer stay "Live" forever (one had been "Live" for 48.5 hours on a 10-minute assessment), and a candidate who reopens a failed interview is never told it was completed.
5. **Protect candidates' data**: another organization could export and overwrite a candidate's portfolio by guessing its id. I confirmed it with a test and fixed it by scoping every lookup to the requesting organization.

Everything is test-driven (24 red commits before their fixes), covered by 57 RSpec examples and 25 Vitest tests that I built from zero, run in a new GitHub Actions workflow, proven by a seeded-fault branch, and verified through six manual QA gates.

---

## 1. Step 1: Setup and local exploration

- Ran both services locally (Rails 7.0 / Ruby 3.3.2 / PostgreSQL 14 / Redis 7.4 / Sidekiq 7.3, React 18 / Vite 6).
- Setup problems I hit and documented: Sidekiq 7.3 needs Redis ≥ 6.2 (the distro Redis was 6.0); `bin/` scripts are committed without the executable bit; invite links point at the API host by default.
- Workflow: fork → `feat/interview-failure-visibility` off `main`, small commits, no direct commits to `main`.
- **Test harness built from nothing:** the repo had no specs, no frontend test runner and no CI.
  - API: RSpec + FactoryBot wiring, tenant helper `within_organization`, request helpers (`get_json … as_admin(org)`) that go through the real tenant middleware and JWT verification, Sidekiq in fake mode.
  - Web: Vitest + jsdom + React Testing Library (ResizeObserver stub for Radix, mock history cleared between tests).
  - CI: GitHub Actions runs RSpec (Postgres + Redis services), `tsc` and Vitest on every push and PR.

## 2. Step 2: Context and domain immersion

**The product.** Assessors define an assessment (skills with L1-L5 anchors), invite a candidate by link, a Gemini Live voice agent interviews the candidate, a coverage map tracks which skills were probed, and the system produces a skill portfolio and a fit-gap report against a vacancy.

**The industry (Indonesia).** High applicant volume per opening and limited interviewer time are the real bottleneck; CV parsing and keyword screening are commoditized. The leverage of a product like this is a *trustworthy* structured interview at scale: if the assessor cannot trust the output, they redo the work manually and the product has no value. Candidates often interview from home or mobile connections, which matters for anything that gates on network quality.

**Comparable products.** I studied candidate reports from Micro1 (a Reddit thread plus my own experience as a candidate there) and TalentGO. The recurring pain points were: interviews that fail silently and are "just redo it", a flat "Not Selected" with no reason, and long waits with no signal. The first two map directly onto what I found in this codebase.

**The users.** Assessors and recruiters need to know, at a glance, whether each candidate was actually assessed, and what to do if not (re-invite, fix the setup, or ignore). Hiring managers consume the portfolio and fit-gap.

**The people affected who never chose it.** A candidate cannot opt out of this product, and a wrong result changes their year. For this project that meant:
- A candidate must never be told something untrue ("recorded") or be left looping.
- Their microphone must not stay open when nothing will use the audio. During QA the live transcript captured **bystanders' private conversation** in the room, which is exactly the kind of personal data UU PDP protects.
- A platform failure must not quietly become a low score: I found that a candidate whose audio never reached the AI is scored L1 instead of "not assessed" (logged, out of scope).
- UU PDP (Law 27/2022): data minimisation and purpose limitation guided what I store. The failure *detail* is a short reason ("duplicate skills"), never exception text, transcripts or names; the full validation text goes only to the server log. Test fixtures use obviously fake names. The law also gives data subjects the right to object to decisions based solely on automated processing, which is another reason the assessor must see when an interview did not really happen.

## 3. Step 3: Problem and gap analysis

**Core problem.** Failures in the interview pipeline are invisible to both people who need to act on them, so the product quietly produces no result, or a misleading one, while everyone believes it worked.

Legend: **Broken** = specified but defective; **Missing** = never specified. ✅ = fixed in this PR.

| Sev | Finding | Service | Type | Impact on the real workflow |
|---|---|---|---|---|
| **P0** | Scoring client is hard-coded to Gemini API `v1` and ships dead model names; with a new API key **no** portfolio, fit-gap or coverage call succeeds | api | Broken | Interviews run but never produce a result; the live monitor's coverage stays "Not Yet" |
| P0 ✅ | `Portfolio`, `PortfolioSkill` (and fit-gap reports) were looked up by bare, sequential ids with no tenant check | api | Broken | An admin of **any** organization could export another company's candidate portfolio (verbatim candidate quotes, AI summaries, levels), **overwrite a candidate's skill level**, and generate or read fit-gap reports on it. Confirmed by `spec/requests/tenant_isolation_spec.rb` (200/201/202 where 404 was expected), then fixed |
| P1 ✅ | The app could not boot with eager loading (production and CI): two WebSocket middleware file names don't match their class names, so Zeitwerk raised `NameError` at boot. Found by the new CI on its first run | api | Broken | Any production deploy (`eager_load = true`) fails to start; local development hid it |
| P1 ✅ | An assessment with a duplicated skill crashes every interview on the `coverage_maps` unique index | api+web | Broken | Every invited candidate is blocked; 107 silent reconnects |
| P1 ✅ | Failed sessions show a bare "Failed"; the cause exists only in the server log | api+web | Missing | Assessor cannot decide to re-invite, fix, or reject |
| P1 ✅ | Candidate is told "Interview Complete, the interview has been recorded" when the interview failed (start failure, lost connection, or reopening a failed link) | web+api | Broken | Candidate believes they were assessed |
| P1 ✅ | Sessions stay "Live" forever after a server restart: every way a session ends lived in the Rails process's memory (seen: 48.5 h on a 10-minute assessment) | api | Broken | Assessor sees a phantom live interview; the candidate is never assessed and never told |
| P1 | Internet speed check fails good connections (US endpoint, 4 Mbps upload threshold for a voice stream) and blocks Start | web | Broken | Candidates on normal Indonesian connections locked out |
| P1 | Invite links point at the API host by default (`APP_BASE_URL`) | api | Broken | Every invite link 404s in a fresh environment |
| P1 | A candidate with zero answers is scored L1; the model has no "not assessed" state | api | Missing | A platform failure can become a rejection |
| P1 | Candidate audio intermittently never reached Gemini while the UI said "You're speaking" | both | Broken | Candidate talks to nothing; not reproduced later |
| P2 ✅ | Removing a skill in the Edit page silently did nothing (no `_destroy` sent) | web | Broken | Broken assessments could not be repaired |
| P2 | Taxonomy `skill_id` is discarded; fit-gap joins vacancy and portfolio skills by label text | web+api | Broken | Fit-gap marks skills "not assessed" when wording differs |
| P2 | Login is admin-only and no user is seeded; an expired dev token lands on a login nobody can use | api | Broken | Non-admin recruiters cannot be provisioned |
| P2 | A temporary AI outage (503) becomes a permanent "failed", and the UI hides the reason | api+web | Broken | Assessor cannot tell "retry later" from "broken" |
| P3 | Monitor with an invalid id reconnects forever instead of "not found" | web | Broken | Confusing assessor state |
| P3 | Auth failure frame sends exception text to the candidate | api | Broken | Internal detail leak |
| P3 | CORS allows any origin (`*`) | api | Hardening | Low risk with Bearer tokens, should be restricted |
| P3 | Vacancy and Assessment are unrelated; skills are defined twice; vacancies cannot be closed | both | Missing | Drift between the job and the interview |
| P3 | A portfolio is generated even when the candidate never said a word | api | Missing | Wasted AI calls and a meaningless result (pairs with the "not assessed" P1) |
| P2 ✅ | Mobile layout: the navbar overflowed at 375 px and pushed every page left | web | Broken | Unusable on phones |

**Constraint signal** (what I would escalate to a Tech Lead on day one):
1. **Tenant isolation of portfolio data** was the highest-risk item. I confirmed it with a test (another organization: export 200, override 201, fit-gap read 200, generate/regenerate 202) and **fixed it in this PR without a migration**: every id-based lookup now goes through `Portfolio.for_tenant` / `PortfolioSkill.for_tenant`, which join through the already tenant-scoped session, so another organization gets 404 (single primary-key walks, checked with EXPLAIN). What I'd still escalate is **defense in depth**: adding `tenant_id` to the portfolio tables so `TenantScoped` protects them automatically and a future endpoint can't forget the scope. That part needs a staged backfill on production data, so it belongs in its own reviewed change.
2. **Vendor drift:** the text client is pinned to an API version where current models are unavailable; model names are duplicated between config and code with different defaults.
3. **Shared tables** (`users`, `organizations`) belong to another service, so real login cannot be exercised standalone.
4. **The real-time audio middleware** (~770 lines, EventMachine + Faye + Gemini Live) had no tests. I added unit coverage for its failure paths, but an end-to-end WebSocket test is still missing.
5. **Consent and capture:** the microphone records everyone in the room; the product needs an explicit consent step before capture.

## 4. Step 4: Revamp strategy, acceptance criteria and trade-offs

**Why this revamp.** It is the smallest change that turns the worst candidate and assessor experiences into honest, recoverable ones, it spans the data model, API, WebSocket layer and two frontends, and it is a prerequisite for trusting any later scoring improvement.

**Acceptance criteria were written before code** ([`acceptance-criteria.md`](acceptance-criteria.md)), grouped as S1 failure reason, S2 candidate message, S3 duplicate skills, and UX polish. Edge cases covered:

| Brief's edge-case family | How it is handled |
|---|---|
| Model call failures | Gemini reconnect exhaustion → `ai_connection_lost`; unexpected start error → `start_failed` with no exception text stored |
| Missing or partial data | Legacy duplicates detected at interview start (validation re-run on read); old failures without a code show "Reason not recorded" |
| Edge-case data | Labels compared after `squish` + case-fold; blank labels ignored; unknown failure codes rejected by model validation and the Postgres enum |
| Long text | Failure detail truncated to 255; alert and reason line wrap (`break-words`, `min-w-0`) |
| Repeated failures | Five failed starts keep one current reason, not five |
| Partial writes | Validation runs before the transaction; a rejected update saves nothing (not even other fields); activation and clearing the old reason are one UPDATE |
| Unassessed skills | Out of scope; logged as a P1 with a proposed "not assessed" state |

**Key decisions and rejected options** (full log in [`decisions-log.md`](decisions-log.md)):

| Decision | Chosen | Rejected, and why |
|---|---|---|
| Where the reason lives | Three nullable columns on `sessions`, Postgres enum for the code | New `end_reason` values: cannot represent "pending but failed" or carry a detail. `session_events` table: history no AC needs, plus a new table to tenant-scope correctly |
| Is a start failure final? | No: session stays `pending`, same link works after the fix | Terminal states force a re-invite for a failure that was never the candidate's fault, and reusing the `ended` path created an empty portfolio for a session that never ran |
| Where duplicate validation lives | Model, via a reusable `UniqueSkillLabelsValidator` | Service-layer validation only protects one write path; a DB unique index now would fail migration on existing duplicate rows (documented follow-up) |
| Wording | Backend owns short assessor messages; one fixed candidate sentence | Showing raw validation text: too detailed for assessors, leaks internals to candidates |
| Error presentation | Bottom-right, dismissible toast (subtle red, accent bar, title) built from existing components and the app's status colors | A toast library (new dependency); a GIF or illustration (weight, tone) |

**Product impact vs cost.** **+355 / −63 lines of application code** (29 files, excluding tests and test tooling) plus a test harness built from zero (whole PR: 71 files, about +2,800 / −66, most of it tests and these documents), two additive migrations, no new runtime dependency (+0.6 kB gzipped on the web bundle).

**Maintainability.** New failure causes are one enum value, one message and one call site. The validator is reusable for vacancy skills. The migration is reversible and verified up → down → up.

**Failure modes of the solution itself.** A race between validation and coverage creation still hits the DB index and is recorded as `start_failed` (rare, visible). Failure history is not kept (latest reason only).

## 5. Step 5: Execution proof

**Shape of the work:** 79 commits; **24 red commits** each precede the change that turned them green. Two additive, reversible migrations.

**Tests:** RSpec 57 examples in 11 files (an eager-load boot check, models, services, workers, request specs through the real auth and tenant middleware, WebSocket failure paths); Vitest 25 tests in 8 files (create/edit forms, list and invite page states, candidate page, WebSocket hook with a fake socket and fake timers).

**Seeded fault test.** On `scratch/seeded-fault-duplicate-skills` I changed one word, comparing skill labels case-sensitively. **4 tests across the model and API layers went red.** The revert is a separate commit; red and green runs are attached in the appendix.

**Designed failure paths.**

| Brief's category | Status |
|---|---|
| Model errors | ✅ Gemini connection loss recorded as `ai_connection_lost`; invalid assessment raises a named domain error instead of `PG::UniqueViolation` |
| Partial writes | ✅ Validation before the transaction; rejected update saves nothing; single-UPDATE activation |
| Duplicate work | ✅ Coverage analysis claims each turn atomically (`UPDATE … WHERE last_analyzed_turn < turn`), so a duplicated or out-of-order job never double-counts; repeated failed starts keep one reason; a rejected save queues no job |
| Timeouts | ✅ A durable per-session deadline (Sidekiq scheduled job, time limit + 5 min) ends orphaned interviews even when Rails is down (verified: Rails stopped, job fired at the deadline, session marked "Failed · Candidate disconnected"). The 120 s grace period only ends *running* interviews. The client reports a lost connection honestly after 3 reconnects. ⚠️ HTTP timeouts on Gemini calls are not addressed (next step) |

**Protected data.** Reversible migration, nullable columns (safe for existing rows), tenant-scoped endpoints (request specs: other organization → 404, non-admin role → 403), no personal data in fixtures, logs or commits (automated scan of the full diff: no keys, tokens or real names).

**UI/UX states.** Error toast bottom-right (full width on mobile) with a subtle red background, accent bar and title, dismissible; unique-name tip; the assessment list shows the latest failure reason; mobile navbar and stacked rows at 375 px; final candidate screens centered; assessor states "Awaiting candidate", "Couldn't start", "Live", "Completed", "Failed", "Reason not recorded"; candidate "Interview unavailable" with icon; long text wraps; motion is CSS-only and disabled for reduced-motion users; icons are hidden from screen readers.

**AI verification moments.** I used Claude Code as leverage and verified its output; six times it was wrong or risky:
1. It recommended `gemini-2.5-pro` from the model list; the API rejected it ("no longer available to new users"). The list shows what exists, not what a key can use.
2. It claimed the invite page polls "with no stop condition"; reading the code showed it stops when every session has ended.
3. A characterization test assumed saving outside a tenant returns `false`; running it showed it raises. The test was corrected to describe reality.
4. It wrote a migration with `create_enum` inside `change` and predicted the rollback would raise `IrreversibleMigration`. **I ran the rollback**: it succeeded but silently left the enum type behind. Both the code and the prediction were wrong; fixed with explicit `up`/`down` and verified.
5. It claimed the cross-tenant fix *required* a data migration on production candidate data. I asked whether the lookups could simply be scoped through the tenant-scoped session; they could, and that is the fix shipped (no migration). The migration is only needed for defense in depth.
6. Its draft let the 120 s grace period end interviews that never started, which silently broke the "same link works" promise. Its unit tests did not cover the socket-close path; **my manual QA caught it**, and a red test now reproduces it.

**Manual QA.** Six gates (A to F), all passed after fixes; four defects were found only by QA (the grace-period bug, the mobile overflow, the silent cleanup task, the 48-hour orphan):

| | Before (`main`) | After (this PR) |
|---|---|---|
| Candidate | ![Candidate stuck on "Briefly reconnecting", timer frozen at 10:00, mic on](screenshots/before-candidate-reconnecting.png) | ![Candidate sees "Interview unavailable" with a clear next step](screenshots/after-candidate-unavailable.png) |
| Assessor | Bare "Failed" or "Awaiting candidate"; the cause is only in the server log | ![Invite page shows "Couldn't start · Assessment needs fixing (duplicate skills)"](screenshots/after-assessor-reason.png) |

Before: the candidate is told it is a brief reconnect, the timer never moves, and the page says "Listening…" with the microphone on, while every attempt fails on the duplicate skill (107 attempts in 2 minutes in the server log).

## 6. Limitations and next steps

- Defense in depth for tenant isolation: `tenant_id` on the portfolio tables with a staged backfill, so `TenantScoped` covers them automatically.
- Make the Gemini API version and model names configuration, with a boot-time smoke check.
- A "not assessed" state for skills without evidence, surfaced in portfolio and fit-gap.
- HTTP timeouts for Gemini calls; classify temporary vs permanent generation failures; skip portfolio generation when the candidate never answered.
- Push the deadline's outcome to a candidate whose tab is still open (today they see it on the next reload).
- A per-organization retry/attempt policy for candidates.
- A read-only task to list assessments with duplicate skills, then an assessor-confirmed cleanup, then the unique index `(assessment_id, lower(skill_label))`.
- Consent step before microphone capture; replace the speed test with a voice-appropriate check.

## 7. Assumptions

- Deadline: **27 September 2026, 23:00 WIB** as shown in the submission portal (the brief text shows an older date).
- No user accounts exist locally, so assessor flows were tested with a locally minted admin JWT.
- The scoring pipeline was exercised once with a local-only patch (`v1beta` + `gemini-flash-latest`) that is **not** part of the PR.
- "Duplicate skills" is currently the only realistic reason an existing assessment is invalid; other causes fall back to "invalid configuration".

## Appendix

- How to run: `cd api && bundle exec rspec` · `cd web && npm test && npx tsc --noEmit`
- Seeded fault evidence: [red run, 4 failures](evidence/seeded-fault-1-red.txt) · [green run after the revert](evidence/seeded-fault-2-green.txt)
- [Acceptance criteria](acceptance-criteria.md) · [Options comparison](options-comparison.md) · [Decisions log](decisions-log.md)
