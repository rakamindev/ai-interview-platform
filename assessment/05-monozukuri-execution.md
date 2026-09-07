# Step 5: Monozukuri Implementation & Pull Request

Step 3 found the problems, Step 4 chose the options. This step is the execution proof: what landed, how I know it works, and where AI-generated code was wrong.

**PR:** Option A — one comprehensive PR across `api` and `web`, branch `feat/product-revamp`.
**Seeded fault:** scratch branch `chore/seeded-fault-proof` — fault commit and revert commit both in history.

---

## 1. Commit history

The branch, each commit reviewable on its own (docs are committed on top):

```
c32deaa docs(step5): refresh seeded-fault evidence after the not-assessed and UI commits
d4b288c docs(step5): fold the not-assessed panel and the UI rework into the execution proof
947e491 docs(step2): add product context and domain immersion
cdcb283 feat(web): rework the candidate interview screen and extend the design system
178f85f feat: name the skills the interview never assessed
38183e7 docs(step5): add a runbook for setting the branch up on another machine
feb301c docs(step5): refresh commit list and captured green test run
d6c64e5 fix(step5): review pass — spec kwargs, stale window, duplicate create, doc accuracy
262cbae docs(step5): add monozukuri execution proof and PR description
64f9ebf docs(step5): add seeded-fault script and captured test evidence
6af2d58 chore(test): commit the lockfile for the new dev dependencies
1fb6cd5 feat(web): surface stalled and failed generation on the portfolio screen
50d76b4 feat(web): confirm before a candidate leaves the interview
08ddab8 fix(web): tell the candidate the truth about how their interview ended
a9941c9 fix(api): keep coverage metadata out of the transcript
1ad10c8 feat(api): make portfolio generation recoverable and duplicate-safe
251f1bd fix(api): stop scoring skills the interview never covered
21111fd chore(test): add RSpec and Vitest harnesses
```

The test harness comes first on purpose. Step 3's first constraint signal was *"no test suite, no CI — prerequisite to fix before Step 5."* Nothing after that commit can claim proven correctness without something to run it against.

---

## 2. Acceptance criteria → code → test

Step 4 §1 defined the criteria before any code was written. This is the traceability table.

| Step 4 acceptance criterion | Where it lives | Test that proves it |
|---|---|---|
| Skill discussed (`state ≠ not_yet`) → save the real score | `CoverageLookup#discussed?` | `coverage_lookup_spec` "treats partial and initiated as discussed" |
| Skill never discussed → skip the row entirely | `SkillSelection#call` | `skill_selection_spec` "drops a skill the interview never touched" |
| Missing / non-numeric `level` on a discussed skill → parse failure for that skill only, no silent coercion | `SkillPayload#normalize_level` | `skill_payload_spec` "rejects a missing level instead of silently scoring it L1" + "rejects a non-numeric level" |
| Duplicate skill entries → last one wins, no duplicate rows | `SkillPayload#dedup_key` + `SkillSelection` | `skill_selection_spec` "collapses duplicate entries" |
| Gemini errors during generation → mark `failed` with a reason, never stuck at `generating` | `Generator#mark_failed`, `Portfolio#generation_stale?` | `generator_spec` "marks the portfolio failed and re-raises when the model times out"; `portfolio_spec` "#generation_stale?" |
| Interview reconnection fails → frontend actually uses `reason: error` | `useAudioWebSocket` → `outcomeFromEndReason` | `interviewOutcome.test.ts`; `InterviewCompleteScreen.test.tsx` "tells a candidate the truth" |
| `level` as float / out of range → round + clamp | `SkillPayload#normalize_level` | `skill_payload_spec` "rounds a float level", "clamps an out-of-range level" |
| …and only ever for a skill that was discussed | `SkillSelection#call` (the coverage gate runs after parsing) | `skill_selection_spec` "drops a skill the interview never touched" |
| Malformed / partial JSON → fail that skill's parse, don't crash the job | `SkillPayload`, `Generator#parse_response` | `skill_selection_spec` "ignores a malformed entry"; `generator_spec` "fails with a generic reason when the model returns something that is not JSON" |
| Coverage JSON split across chunks → buffer until structurally complete, no fragment reaches the transcript | `TranscriptSanitizer::Stream` | `transcript_sanitizer_spec` "holds back a payload split across two chunks", "survives a payload split across three chunks" |
| `end_reason: completed` → success; `error` / `timeout` / unrecognised → distinct failure screen, never success | `outcomeFromEndReason` | `interviewOutcome.test.ts` "never reads a missing reason as success", "never reads an unrecognised future reason as success" |
| Exit dialog: Continue → stays; End → ends normally | `useExitGuard` + `ExitConfirmDialog` | `useExitGuard.test.ts`; `ExitConfirmDialog.test.tsx` |
| …timer unaffected on Continue | `useExitGuard` never touches `InterviewTimer`; Continue only closes the dialog | **not asserted by a test** — true by construction, verified by reading the diff |
| UI polish: every state visually distinct, mobile-safe, long text handled | `InterviewCompleteScreen`, `PortfolioPage`, `ExitConfirmDialog`, `StatusBanner` | `InterviewCompleteScreen.test.tsx` (three distinct `data-outcome` states); `StatusBanner.test.tsx` (four tones carried as `data-tone`) |
| Empty state: a portfolio with zero scored skills is a real outcome now | `PortfolioPage` empty card | not asserted — verified by hand, `data-testid="portfolio-empty"` |
| A skill dropped for lack of evidence is shown as unknown, not omitted | `Portfolios::NotAssessedSkills` + `NotAssessedPanel` | `not_assessed_skills_spec`; `NotAssessedPanel.test.tsx` |

Two Step 4 criteria have **no automated test** and I would rather say so than pad the table:

- *"retry with bounded backoff"* on Gemini errors — already handled by `Faraday`'s retry middleware in `Gemini::HttpClient`, which I did not change and did not write a test for.
- Responsive layout — verified by hand at 375px and 1440px, not by a test. There is no visual-regression tooling in this repo and adding one was not worth the scope.

---

## 3. Test coverage evidence

### Frontend — actually run

```
 ✓ src/hooks/__tests__/useExitGuard.test.ts (5 tests)
 ✓ src/components/interview/__tests__/InterviewCompleteScreen.test.tsx (5 tests)
 ✓ src/components/interview/__tests__/ExitConfirmDialog.test.tsx (5 tests)
 ✓ src/components/interview/__tests__/InterviewTimer.test.tsx (5 tests)
 ✓ src/components/interview/__tests__/StatusBanner.test.tsx (3 tests)
 ✓ src/components/portfolio/__tests__/NotAssessedPanel.test.tsx (5 tests)
 ✓ src/lib/__tests__/interviewOutcome.test.ts (8 tests)

 Test Files  7 passed (7)
      Tests  36 passed (36)
```

Full output: `assessment/step5/evidence/vitest-green.txt`.

### Backend

Seven spec files. Five of them require **no database and no Rails boot at all**, because the logic that decides a hiring outcome was deliberately extracted into plain Ruby objects:

| Spec | Needs a database? | What it guards |
|---|---|---|
| `spec/lib/transcript_sanitizer_spec.rb` | no | the confirmed-live transcript leak, including the split-chunk case |
| `spec/services/portfolios/skill_payload_spec.rb` | no | the `nil.to_i.clamp(1, 5)` fabrication |
| `spec/services/portfolios/coverage_lookup_spec.rb` | no | "was this skill actually discussed" |
| `spec/services/portfolios/skill_selection_spec.rb` | no | the two rules together, plus duplicates and malformed entries |
| `spec/services/portfolios/not_assessed_skills_spec.rb` | no | which configured skills carry no score, and which of the two reasons applies |
| `spec/models/portfolio_spec.rb` | yes | stale-generation detection, including pre-migration rows |
| `spec/services/portfolios/generator_spec.rb` | yes | duplicate jobs, stale reclaim, timeouts, partial writes, PII truncation |

That split is the point of the design, not an accident: the rule that can fail a candidate is testable in milliseconds with no infrastructure.

```bash
cd api && bundle exec rspec
# database-free subset:
bundle exec rspec spec/lib spec/services/portfolios/skill_payload_spec.rb \
                  spec/services/portfolios/coverage_lookup_spec.rb \
                  spec/services/portfolios/skill_selection_spec.rb
```

---

## 4. Seeded fault test

Three faults, seeded on `chore/seeded-fault-proof`, each one reintroducing a real Step 3 P0:

1. `outcomeFromEndReason` — an unknown or missing `end_reason` falls back to `"completed"`.
2. `CoverageLookup#discussed?` — always returns `true`.
3. `SkillPayload#normalize_level` — a missing level collapses to `to_i` (`0` → `1`).

### What the frontend suite did

```
 FAIL  interviewOutcome.test.ts > never reads an unrecognised future reason as success
 AssertionError: expected 'completed' to be 'error'

 FAIL  InterviewCompleteScreen.test.tsx > defaults to the error screen when no reason reached the frontend
 Expected the element to have attribute: data-outcome="error"
 Received:                               data-outcome="completed"

 Test Files  2 failed | 2 passed (4)
      Tests  3 failed | 20 passed (23)
```

Full output: `assessment/step5/evidence/seeded-fault-vitest.txt`.

### What the backend rules did

The selection logic, run against the seeded faults, produced the fabricated score itself:

```
1) SelectionTest#test_drops_not_discussed
   Expected: ["sk-eng-001"]
     Actual: ["sk-eng-001", "sk-eng-002"]      # the undiscussed skill is back

2) SelectionTest#test_missing_level_not_coerced
   Expected [#<Portfolios::SkillPayload ... @level=1 ...>] to be empty.
                                              ^^^^^^^^^ the fabricated L1, reproduced

3) SelectionTest#test_non_numeric_level          "unknown should be rejected"
4) SelectionTest#test_no_coverage_row_is_conservative

12 runs, 28 assertions, 4 failures
```

The not-assessed rules caught the same fault from the other side — with the
coverage gate broken, a skill that was never discussed gets reported to the
assessor as `no_rating` ("we asked, the AI gave nothing") instead of
`not_discussed` ("we never asked"):

```
NA#test_not_discussed
   Expected: :not_discussed
     Actual: :no_rating

5 runs, 9 assertions, 1 failures
```

Full output: `assessment/step5/evidence/seeded-fault-backend-logic.txt`.

> **Environment note, stated plainly:** the machine I ran the seeded fault on had no network access to RubyGems and no PostgreSQL, so I could not execute `bundle exec rspec` there. The backend failures above were produced by running the same assertions against the same objects through Ruby's bundled Minitest. The RSpec specs in `spec/` are the deliverable and assert the same behaviour; `assessment/step5/seeded-fault.sh` reproduces the whole thing — seed, watch both real suites fail, revert — on a machine with the gems and a test database.

### Revert with history visible

```
0ac4e41 Revert "test(seeded-fault): deliberately break the two P0 rules to prove the tests catch them"
1b03c4f test(seeded-fault): deliberately break the two P0 rules to prove the tests catch them
6af2d58 chore(test): commit the lockfile for the new dev dependencies
```

The fault never touched `feat/product-revamp`: `git diff feat/product-revamp chore/seeded-fault-proof` is empty after the revert.

---

## 5. AI verification moments

Three cases where AI-generated code was wrong or risky. The first one would have shipped a new bug on top of the one I was fixing.

### 5.1 The fix that would have broken the case it was fixing

The generated `useAudioWebSocket` change reported the real `end_reason` in the `session_ended` branch and, in `ws.onclose`, reported `"error"` once the reconnect attempts ran out. Both look right in isolation.

But `disconnect()` — called when the candidate ends their own interview — did this:

```ts
reconnectAttemptsRef.current = RECONNECT_DELAYS.length; // prevent reconnect
wsRef.current?.close();
```

It pushed the attempt counter to the maximum and then closed the socket. `onclose` fired, `sessionEndedRef` was still `false`, the attempt counter was already at the limit, so it fell into the "out of attempts" branch and reported `"error"`. **A candidate who deliberately ended their own interview would have been shown the failure screen** — a brand-new lie, in the code written to stop the old one.

**How I caught it:** the change touched the meaning of `onclose`, so I traced every caller of `disconnect()` by hand instead of trusting the diff. No test caught it — the hook has no test, and I am not going to claim otherwise.

**Fix:** `disconnect()` now sets `sessionEndedRef.current = true`, because an intentional local close is not a failure. The comment in the code says exactly that, so the next person does not undo it.

### 5.2 `return` inside a locked transaction

The first version of the duplicate-job guard read:

```ruby
portfolio.with_lock do
  return false if portfolio.generating? && !portfolio.generation_stale?
  portfolio.update!(...)
end
true
```

`with_lock` opens a transaction. Returning out of a transaction block changed meaning in Rails 6.1 — it no longer rolls back, it commits — and relying on which side of that change you are on is exactly the kind of thing that quietly breaks on an upgrade.

**How I caught it:** I checked the Rails version in the Gemfile (`~> 7.0.8`) before accepting the pattern, rather than assuming.

**Fix:** a plain `claimed` flag set inside the block and returned after it. Nothing depends on transaction-control semantics, and it reads the same in any Rails version.

### 5.3 A timestamp column that does not exist

The generated `mark_failed` used:

```ruby
portfolio.update_columns(generation_status: 'failed', generation_error: reason, updated_at: Time.current)
```

Plausible Rails. But `portfolios` in `db/schema.rb` has **no `created_at`/`updated_at` at all** — it is one of the few tables in this schema without timestamps. That line would have raised `ActiveRecord::StatementInvalid` inside the error handler, turning a recoverable Gemini failure into a crash in the code meant to record it.

**How I caught it:** I read `db/schema.rb` for the table before writing to it, instead of assuming Rails conventions hold in a schema that was clearly hand-built (it uses PostgreSQL enums and check constraints throughout).

**Fix:** a plain `update!` with only the two columns that exist.

### 5.4 A timeout window shorter than the thing it was timing

`Portfolio::STALE_GENERATION_AFTER` was first written as 10 minutes, with a comment claiming that was "generous enough to cover the 180s Gemini timeout plus Sidekiq's retry backoff."

It wasn't. `Gemini::HttpClient#build_connection` configures `f.request :retry, max: 3` on top of `f.options.timeout = 180`, and `Faraday::TimeoutError` is in faraday-retry's default retriable set — so a single `generate_content` call can legitimately run for 4 × 180s plus backoff, around **12 minutes**. A perfectly healthy generation would have been declared stale at minute 10, and `claim_for_generation` would have handed the row to a second worker while the first was still writing to it. The duplicate-job guard would have *created* the duplicate-write race it exists to prevent.

**How I caught it:** the constant is only meaningful relative to the client's real worst case, so I opened `Gemini::HttpClient` and did the arithmetic instead of trusting the comment that came with the code.

**Fix:** 20 minutes, with the arithmetic written into the comment so the next person changing the Gemini timeout can see what it is coupled to.

### 5.5 A test that could not run

`skill_payload_spec.rb` defined its helper as `def payload(overrides = {}, discovered: false)` and called it as `payload('level' => nil)`. Under Ruby 3's keyword separation, a brace-less hash next to a keyword parameter is parsed as *keywords*, so 9 of the 12 examples raised `ArgumentError: unknown keyword: "level"` before asserting anything — including both examples that guard the headline P0.

The production code was correct the whole time. The spec was not, and a spec that errors is worse than no spec, because the summary line still says something.

**How I caught it:** a review pass that ran the assertions rather than reading them.

**Fix:** the parameter is positional and every call site braces its hash explicitly, with a comment saying why.

**The pattern across all five:** AI code is confidently idiomatic, and idiomatic is not the same as correct *for this codebase*. Every one of these was caught by checking the diff against something specific and local — the callers, the Gemfile, the schema, the client's own retry configuration, the interpreter's kwargs rules — not by reading the generated code again.

---

## 5b. The bug the fix created

Worth calling out separately, because it is the part I am most likely to be asked about.

Removing the fabricated L1 was correct and, on its own, made the assessor's screen
worse. Those skills stopped appearing at all. An assessor looking at a portfolio
with two scored skills could no longer tell "this candidate is strong and the role
only has two skills" apart from "three of the five were never asked about." The
data became right and the screen started lying by omission instead.

The whole point of the P0 was to stop a hiring decision resting on a number nobody
earned. A silently missing row invites exactly the same mistake from the other
direction — a reviewer fills the silence with an assumption.

So `Portfolios::NotAssessedSkills` names them, and separates the two cases that
mean different things to an assessor:

- **`not_discussed`** — the interview never reached this skill. Nothing was
  learned. Re-interview, or accept the gap in coverage.
- **`no_rating`** — it *was* discussed, but the model returned nothing it could
  defend a level with. There is a transcript to read. This one is on the AI, not
  on the candidate.

`NotAssessedPanel` shows both with the level the role expected, and says outright
that these are gaps in the interview and not in the candidate.

A portfolio can also legitimately have zero scored skills now, which used to be
practically impossible. That case used to render as a heading with nothing under
it; it has a real empty state.

## 6. Designed failure paths

| Failure | What happens now |
|---|---|
| **Gemini timeout** | `Faraday` retries with backoff; on exhaustion the portfolio is marked `failed` with the exception class and a 200-char message, and the error is re-raised so Sidekiq's retry policy still applies. |
| **Malformed model output** | Raises `MalformedResponseError` with a fixed, generic message — the raw body, which quotes the candidate, is never persisted or logged. |
| **One bad skill in an otherwise good response** | That entry alone is skipped and logged with a reason. The other skills still save. |
| **Partial write** | `destroy_all` + `create!` share one transaction. A failure halfway through rolls back and the previous skill set survives — asserted in `generator_spec`. |
| **Duplicate job** | The row is claimed under a lock. A second job on a live attempt returns early and does not call Gemini. |
| **Worker killed mid-run** | The `generating` row goes stale after 10 minutes and is reclaimed on the next attempt. Pre-migration rows have `NULL` and are stale immediately. |
| **WebSocket dies past the reconnect budget** | Backend sends `session_ended reason: error`; the candidate now sees the failure screen with the backend's own message. |
| **Candidate navigates away mid-interview** | Confirmation dialog with a real choice; Continue leaves the session and the timer untouched. |
| **Interview link invalid or expired** | Its own message on the failure screen, not a fake success. |
| **Payload that never closes in the transcript stream** | The buffer cap releases the text instead of swallowing speech indefinitely. |

---

## 7. Data protection (UU PDP)

- **Nothing candidate-identifying reaches the logs or the `generation_error` column.** A model error can echo the transcript back; both `Generator#mark_failed` and the worker's retries-exhausted hook truncate to the exception class plus 200 characters. The prompt and the raw response body are never logged.
- **The one new log line contains skill labels only** — role metadata, not personal data.
- **The one new field exposed to a candidate** is `end_reason` on `candidate_info`: an internal enum about their own session, reached with their own invite token.
- **No endpoint was opened up.** `regenerate` stays behind `authorize_auth_token! :assessor`; the change only widens *which state* is retryable, not who may retry.
- **No PII in this diff** — no fixtures, seeds or screenshots contain real candidate data. Factories use `sequence`-generated placeholder values.

Step 3's data-deletion finding (Internal/Candidate P1) is unchanged and still deferred, with the soft-delete direction documented in Step 4 §2.6. It is worth being explicit that this PR does not claim to close it.

---

## 8. Known limitations

Stated up front rather than discovered in review:

1. **`useExitGuard` leaves its sentinel history entry behind.** After the interview finishes, the candidate may need one extra back press to leave the page. Popping it automatically risks navigating them somewhere unintended, so I left it — a nuisance, on a screen that is finished anyway.
2. **The local timer's `time_ceiling` is a display reason.** When the client-side timer expires, the completion screen says "Time is up" while the backend records `manual_candidate` for that path. The candidate is told the truth; the backend's own `time_ceiling` path is unchanged. Making the two agree means sending a reason on `end_session`, which is a backend protocol change I did not want inside a P0 fix.
3. **`useAudioWebSocket` itself has no test.** It needs a WebSocket harness that does not exist in this repo yet. The logic it feeds is fully tested; the wiring is not, which is exactly how bug 5.1 got as far as it did.
4. **Neither the empty state nor "timer unaffected on Continue" is covered by a test.** Both are verified by hand and by reading the diff. Rendering `PortfolioPage` in a test needs three API mocks; it was not worth it for a branch this size, and I would rather say so than imply coverage I do not have.
5. **The sanitizer holds back any unclosed `{`, not only a metadata one.** A candidate who says something with a stray opening brace has that turn delayed until the 600-character cap releases it. The cap makes the worst case bounded and short, but it is a trade-off, not a free win.
6. **No CI pipeline.** The suites run locally with one command each. Wiring GitHub Actions is the obvious next commit and did not fit this cycle.

---

## 9. One thing found along the way

Not part of this PR, flagged because it is a real finding.

The local workaround for the September Gemini API-key change moves the key from a header into the WebSocket URL:

```ruby
Faye::WebSocket::Client.new("#{GEMINI_WS_URL}?key=#{CGI.escape(@api_key)}")
```

Query strings end up in proxy logs, access logs and error trackers in a way that headers do not. It unblocks local development, but it should not reach production in that shape — the key belongs in a header, or in the setup frame. Worth its own ticket rather than a silent commit.
