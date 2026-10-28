# AI verification log

Real instances where AI-generated code or commands (Claude Code, pairing with me) were wrong or
risky, and how they were caught. Appended as they happen.

## 1. False "every model returns 404" diagnosis (2026-10-23, Task B)

- **What was generated:** a zsh loop to test which Gemini models work:
  `curl ... "https://generativelanguage.googleapis.com/$v/models/$m:generateContent"`.
- **What went wrong:** every model, including ones that work, came back 404 with an empty body.
  The tempting conclusion was "the key cannot call any model".
- **Why it was wrong:** in zsh, `$m:g...` is parsed as a history-style modifier on `$m`, so the
  URL sent was not the URL written. The 404s were caused by the test, not by Gemini.
- **How it was caught:** an empty-body 404 is unusual for a Google API, so I sent one request
  with headers dumped (`curl -D -`) instead of trusting the status code. It returned 200.
  Re-ran the loop with `${m}` braces.
- **Fix:** `${v}` / `${m}` in every URL. No commit involved (local diagnostics only).
- **Lesson kept:** check the raw response before concluding from a status code.

## 2. "The model exists, so it works" (2026-10-23, Task B)

- **What was generated:** a check that called `GET /v1/models/<id>` and treated 200 as "usable";
  on that basis `GEMINI_PRO_MODEL` was switched to `gemini-2.5-pro`.
- **What went wrong:** the metadata endpoint returned 200, but `generateContent` returned 404:
  "This model ... is no longer available to new users".
- **How it was caught:** the portfolio still failed after the switch; the full error body was in
  `log/development.log` (the stored `generation_error` only said "API returned 404", which is
  itself finding N2).
- **Fix:** test models with a real `generateContent` call. Local config now uses
  `gemini-2.5-flash`, documented as an assumption in `03-findings.md`.

## 3. Wrong diagnosis: "the nested transaction did not roll back" (2026-10-24, Task D, AC2.9)

- **What was generated:** when the AC2.9 spec failed (3 skills left instead of 2), I explained it as
  "a nested `transaction` without `requires_new: true` creates no savepoint inside the RSpec
  example's transaction", added `requires_new: true`, and first wrote this entry claiming the React
  skill had been updated. That was never observed: the React level assertion had passed.
- **How it was caught:** the spec still failed after the change (see #4 for the real cause). While
  re-reading this log I noticed the entry described something I had not seen, so I tested the claim:
  removed `requires_new`, ran the generator spec, and all 18 examples passed.
- **Why the explanation was wrong:** rspec-rails opens its per-example transaction as non-joinable,
  so a nested `transaction` in app code already gets a savepoint. The extra row came from #4 only.
- **What was kept:** `requires_new: true` stays as a defensive choice (it matters if a caller opens
  a joinable transaction and rescues the error). The code comment was corrected to say exactly
  that, in a separate commit so the correction is visible in history.

## 4. Half-written skill saved by the error path (2026-10-24, Task D, AC2.9)

- **What was generated:** new skills built with `portfolio.portfolio_skills.build`, and the
  existing `rescue` in `Generator#call` marks the portfolio failed with `portfolio.update!`.
- **Why it was wrong:** a built record stays in the has_many association. When the save inside the
  transaction failed, the rescue's `portfolio.update!` autosaved that unsaved skill, outside the
  rolled-back transaction. A failed generation would leave a partial portfolio behind, which is
  exactly F5. This would also happen in production (Sidekiq has no outer transaction).
- **How it was caught:** the same spec still reported 3 skills instead of 2. Instead of guessing, I
  printed the surviving rows: the extra one was the skill whose save had raised.
- **Fix:** create new rows with `PortfolioSkill.new(portfolio_id: portfolio.id)`, with a comment on
  why. Both fixes are needed; the spec now passes and stays as a regression guard.

## 5. Regenerate that immediately looked stalled (2026-10-26, Task D, AC7.3 / AC8)

- **What was generated:** the regenerate endpoint reset `generation_started_at: nil`, and
  `Portfolio#stale?` falls back to `session.ended_at` when that is nil.
- **Why it was wrong:** for any session that ended more than 20 minutes ago, a portfolio that had
  just been queued counted as stalled, so a second click would enqueue a second job: the duplicate
  job bug (F6) this change exists to remove. All 137 specs were green at that point.
- **How it was caught:** reading my own controller diff before committing. I wrote the missing spec
  first ("does not let a second click restart a run that was just queued"), watched it fail with
  200 instead of 409, then fixed it.
- **Fix:** set `generation_started_at: Time.current` when queuing, with a comment.

## 6. Test expectations I wrote wrong (2026-10-27, Task D, web)

- **What was generated:** two assertions in the ComparisonTable contract test: "find L2 in the
  Communication row" and "summary says 2 match".
- **Why they were wrong:** that row has L2 in both Required and Candidate, so the query was
  ambiguous; and the contract's Testing row is a *provisional* match, which by AC4.2 must not be
  counted as a firm match, so "1 match, 1 provisional" is correct.
- **How it was caught:** both failed after the component was written. I checked each failure
  against the acceptance criteria before touching anything, because changing a test is exactly
  where "weakening an assertion" would happen.
- **Fix:** the first assertion became stricter (the 2nd cell of each row must contain the required
  level); the second now expects the AC4.2 counts. Neither check was removed.

## 7. A bug that was not there (2026-10-27, Task D, browser check)

- **What happened:** after rewriting PortfolioPage, a screenshot and a `find` showed no candidate
  name, and I reported it as a regression.
- **How it was checked:** the API response had the name; I added an assertion to the page test
  (it passed), then inspected the live DOM: the name was rendered. The screenshot had been taken
  before the session request returned.
- **Outcome:** no code change; the extra assertion stays. Lesson: check the DOM, not a screenshot
  taken during loading.

## 8. A fake password that a secret scanner flagged (2026-10-24, PR #185)

- **What was generated:** the AC10 spec used a literal fake password as the value to be filtered, and
  the same literal was copied into the N1 evidence and a test output file.
- **Why it was risky:** it was never a real credential, but a password-shaped literal in a public
  repo trips secret scanners, and "committing secrets" is a disqualifier for this exercise. My own
  pre-push scan only looked for token and key formats (`eyJ…`, `AIza…`), so it missed it.
- **How it was caught:** GitGuardian's check on the PR flagged it in `filter_parameter_logging_spec.rb`
  (commit `273ccd3`).
- **Fix:** forward, not by rewriting history (rewriting would change every commit hash cited in the
  report and the seeded fault evidence). The spec now generates credential-like values per run; the
  literal is gone from the docs and evidence. I removed the initializer temporarily to confirm the
  spec still fails without the filter (8 of 9, as before), then restored it. The pre-push scan now
  also looks for credential-like assignments.

## 9. A lock any job could release (2026-10-24, found while listing where the lock could fail)

- **What was generated:** `FitGap::GenerationLock.release(portfolio_id, vacancy_id)` deleted the key
  unconditionally, and the worker called it in `ensure`.
- **Why it was wrong:** an override deliberately queues a refresh even while a run is in progress.
  That refresh never took the lock, but its `ensure` still deleted it, freeing the other run's lock
  early so a third request could start a duplicate job. All specs were green: none had a second
  job in flight.
- **How it was caught:** reviewing the lock for failure modes after the feature was done. The new
  spec "refreshes after an override without freeing the lock of a run in progress" failed first.
- **Fix:** `acquire` returns a UUID stored as the key's value; `release` is a Lua compare-and-delete,
  so only the token holder can release; the token travels as the job's third argument (optional,
  so jobs already queued with two arguments still run). Checked on the live server: a refresh during
  a held lock left the lock in place.
