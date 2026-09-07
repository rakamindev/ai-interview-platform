# Step 5 — Monozukuri implementation

**Branch:** `feat/product-revamp` → `main`
**Structure:** Option A — one comprehensive PR across both services.
**Scratch branch with the seeded fault:** `chore/seeded-fault-proof` (fault commit + revert commit, both visible).

---

## What this closes

Everything here comes straight from the Step 3 findings and the Step 4 chosen options. Nothing new was invented mid-implementation.

| # | Step 3 finding | Severity | Step 4 option | Status |
|---|---|---|---|---|
| 1 | Skills never discussed still get a fabricated L1–L5 score | Internal + Candidate **P0** | A — check coverage state, skip the row, wrap in a transaction | ✅ shipped |
| 3 | Completion screen always says "✅ Interview Complete" | Candidate **P0** | A — pass the real `end_reason` through, render per reason | ✅ shipped |
| 4 | No exit confirmation, no resume once left | Candidate **P0** | A — confirmation dialog with Continue / End | ✅ shipped |
| 5 | Coverage JSON leaks into the transcript | Internal/Candidate **P2** | A — brace-depth aware sanitizer | ✅ shipped |
| — | `save_skills` has no transaction | Internal **P1** | (folded into #1) | ✅ shipped |
| — | Transcript panel doesn't auto-scroll | Candidate **P2** | UI polish clause in Step 4 §1 | ✅ shipped |
| — | Scored skills vanish from the assessor's screen (created by fix #1) | follow-on | name them explicitly instead of omitting them | ✅ shipped |
| — | Candidate screen UI/UX below the bar the brief sets | Monozukuri clause | extend the design system, rework the screen | ✅ shipped |
| 2 | No role separation between internal personas | Internal **P0** | A — real roles, deferred | ⏸ design only (Step 4 §3) |
| 6 | No data delete/retention path | **P1** | A — soft delete, deferred | ⏸ design only (Step 4 §3) |
| 7 | Vacancy has no employment type / deadline | **P3** | A — enum + date, deferred | ⏸ design only (Step 4 §3) |

Items 2, 6 and 7 keep the chosen direction documented in Step 4 §2. They are out of this cycle for the reasons given there — changing authorization across every controller with no pre-existing test coverage is the single highest-risk change in the report, and it should not be the first thing that lands on a suite that was empty last week.

**One addition beyond the Step 4 table:** the migration described below. Step 4's acceptance criteria already required *"Never stuck at `generating` forever"*, and the Step 3 evidence screenshot shows exactly that state with no way out. Delivering that criterion honestly needs two columns, so this PR carries the data-model change that the acceptance criteria implied.

---

## The change, service by service

### API — scoring integrity (`fix(api): stop scoring skills the interview never covered`)

The bug was one expression:

```ruby
ai_level: skill_data['level'].to_i.clamp(1, 5)
```

`nil.to_i` is `0`, and `0.clamp(1, 5)` is `1`. A skill the model never rated became a real L1 in the database, and `FitGap::Engine` compared that invented level against the vacancy's expected level and reported a genuine gap. A candidate could fail on a skill the AI never asked about.

Three plain-Ruby objects now own the rule, so it can be tested without a database:

- **`Portfolios::SkillPayload`** — parses one entry. A missing or non-numeric level makes it *invalid*, not `1`. Floats are rounded and out-of-range integers clamped, but only once the value is known to be a number.
- **`Portfolios::CoverageLookup`** — answers "was this discussed?" from the final coverage map. `not_yet`, or no coverage row at all, means no.
- **`Portfolios::SkillSelection`** — applies both rules, collapses duplicates (last wins), and returns what was kept alongside what was skipped and why.

Skipped skills are simply not written. `FitGap::Engine` already renders a missing portfolio skill as `not_assessed`, so **no schema change was needed for this fix** — exactly as Step 4 predicted.

`save_skills` now runs `destroy_all` and the `create!` loop inside one transaction, closing the Internal P1 at the same time.

### API — generation recovery (`feat(api): make portfolio generation recoverable and duplicate-safe`)

**Migration `20260907000000_add_generation_tracking_to_portfolios`:**

```ruby
add_column :portfolios, :generation_started_at, :datetime
add_column :portfolios, :generation_attempts, :integer, default: 0, null: false
add_index  :portfolios, %i[generation_status generation_started_at], name: "index_portfolios_on_generation_progress"
```

Safety, deliberately:

- **Additive only.** No existing column is altered, renamed or dropped.
- **Safe on existing rows.** `generation_started_at` is nullable, so old rows keep working — and a pre-migration row stuck on `generating` reads as `NULL`, which counts as stale, which makes it reclaimable. The rows that are stuck today unstick themselves on the first retry.
- **No table rewrite.** PostgreSQL 11+ stores a non-volatile `DEFAULT` as catalog metadata, so `NOT NULL DEFAULT 0` does not rewrite `portfolios` and does not hold a long lock.
- **Reversible.** `change` with `add_column`/`add_index` is auto-reversible; `rails db:rollback` removes exactly these three things and nothing else.

Behaviour built on top:

- `Portfolios::Generator#claim_for_generation` takes a **row lock** before calling Gemini. A second job arriving while a fresh attempt is in flight returns early instead of racing `destroy_all` + `create!`. This is the normal case, not an edge case: `Sessions::EndHandler`, Sidekiq retries and the assessor's Retry button all enqueue N10.
- A `generating` row older than `Portfolio::STALE_GENERATION_AFTER` (10 min) belongs to a dead worker and is reclaimed.
- `regenerate` now accepts a *stalled* portfolio, not only a `failed` one — the exact case the Step 3 screenshot was showing.

### API — transcript sanitizer (`fix(api): keep coverage metadata out of the transcript`)

The old filter only stripped the payload when the chunk **started with `{`**:

```ruby
text.sub(/\A\s*\{.*?"discovered"\s*:\s*\[.*?\].*?\}\s*/m, '')
```

Gemini routinely splits one payload across two transcription chunks, so the second chunk started with a bare `,` and went through untouched — confirmed live in both the candidate's chat bubble and the assessor's Live Monitor.

`TranscriptSanitizer` replaces the regex chain with brace-depth scanning (string-literal aware) plus a per-connection `Stream` that holds an incomplete object back and re-joins it with the next chunk. The buffer has a hard cap so a payload that never closes releases the text rather than silently swallowing real speech.

### Web — honest completion screen (`fix(web): tell the candidate the truth…`)

`useAudioWebSocket` threw away both `reason` and `message` from `session_ended` and always called `onStateChange("complete")`. In the reviewed assessment **8 of 12 sessions ended with `end_reason: "error"`**, so most candidates were told their interview had succeeded.

- `outcomeFromEndReason` maps the reason to `completed` / `timed_out` / `error`. The rule that matters: **an unknown or missing reason resolves to `error`, never to success** — a reason added next year cannot silently regress into a lie.
- `InterviewCompleteScreen` renders three visually distinct states and surfaces the backend's own message on failure.
- `disconnect()` now marks the close as intentional. Without that, a candidate ending their own session fell into the "out of reconnect attempts" branch and was shown an error — see the AI verification moment in the execution doc.
- A candidate reopening a finished link is told how it actually ended, via `end_reason` on `candidate_info` (an internal enum, not personal data).

### Web — exit guard (`feat(web): confirm before a candidate leaves the interview`)

`useExitGuard` covers both exit paths: `beforeunload` for tab close/refresh, and a sentinel history entry re-pushed on every `popstate` so the back button lands on our dialog instead of unmounting the interview. `ExitConfirmDialog` offers a real choice with copy that differs by entry point; Continue is the primary action because it is the safe one, and Escape is trapped so a stray key press cannot end a hiring interview.

Choosing Continue leaves the session and the timer completely untouched — the guard never touches `InterviewTimer`. Full session *resume* is deliberately out of scope — Step 4, Option B under "No exit guard".

### Web — naming what was not assessed

Removing the fabricated L1 made those skills disappear from the assessor's screen
entirely. Correct data, new lie: two scored skills out of five reads as a short
portfolio, not as an incomplete interview.

`Portfolios::NotAssessedSkills` lists the configured skills with no score and
separates **`not_discussed`** (the interview never reached it) from **`no_rating`**
(it was discussed, but the model returned nothing defensible). `NotAssessedPanel`
renders them with the level the role expected and says outright that these are gaps
in the interview, not in the candidate. `PortfolioPage` also gets a real empty state
— zero scored skills is a genuine outcome after this change.

### Web — candidate screen and design system

The candidate screen carries the product's first impression and was the least
designed surface in the app. Semantic status tokens (`success` / `warning` /
`danger` / `info`, each with a subtle background and border) are now defined once
for both themes and registered in Tailwind, replacing hardcoded `green-600` /
`amber-50` / `red-200` across the candidate and portfolio flows — one meaning, one
appearance, and it follows the theme. `StatusBanner` replaces three duplicated
banner blocks. `InterviewTimer` is a countdown ring plus digits, where colour is
never the only signal. Plus `pb-safe` for the iOS home indicator and a
`motion-safe-only` utility honouring `prefers-reduced-motion`.

### Web — assessor portfolio states (`feat(web): surface stalled and failed generation…`)

The page polled every 5s forever whenever status was `generating`. A stalled generation now has its own state with a plain explanation and a retry, polling stops once the server says nothing is running, and the failed state shows the recorded reason and the attempt number.

---

## Tests

```
web:  npm test          → 7 files, 36 tests passing
api:  bundle exec rspec → 7 spec files (5 run with no database at all)
```

Every P0 rule has a test that fails when the rule is removed — proven on `chore/seeded-fault-proof`, with the captured output in `assessment/step5/evidence/`.

---

## Data protection (UU PDP)

- **No transcript text in error columns or logs.** A Gemini error can quote the candidate. `Portfolios::Generator#mark_failed` persists the exception class plus 200 characters, and `PortfolioGeneratorWorker`'s retries-exhausted hook is truncated the same way. The prompt and the raw response body are never logged.
- **No PII in the new logs.** The skipped-skills log line contains skill labels only — role metadata, not personal data.
- **No PII in this diff.** No fixtures, seeds or screenshots contain a real candidate's data. The one new field exposed to the candidate (`end_reason`) is an internal enum about their own session.
- **Endpoints unchanged in reach.** No endpoint was opened up; `regenerate` still sits behind `authorize_auth_token! :assessor` and only widens *which state* is retryable.

---

## How to run

```bash
# API
cd api && bundle install && bin/rails db:migrate && bundle exec rspec

# only the specs that need no database
bundle exec rspec spec/lib spec/services/portfolios/skill_payload_spec.rb \
                  spec/services/portfolios/coverage_lookup_spec.rb \
                  spec/services/portfolios/skill_selection_spec.rb

# Web
cd web && npm install && npm test && npx tsc --noEmit

# Seeded fault, end to end
./assessment/step5/seeded-fault.sh
```

Rollback: `cd api && bin/rails db:rollback STEP=1`.
