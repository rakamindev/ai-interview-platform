# Step 5: the API changes, step by step

A walkthrough of the six API changes, for reading before the technical defense. Each one follows the same path:
what was wrong, where the fix lives, what runs in what order, what holds even if the code is wrong, which tests
prove it, and what's still open.

Run the API suite (Docker stack up, see the [README](../README.md)):

```sh
docker compose exec -T -e RAILS_ENV=test api bundle exec rspec
```

Today: 386 examples, 0 failures, 3 pending (known defects outside these changes: P1-10, P2-3, C2).
To run one area, pass its spec files, for example
`docker compose exec -T -e RAILS_ENV=test api bundle exec rspec spec/services/portfolios/generator_spec.rb`.

| # | Change | Finding | Sub-PR |
|---|---|---|---|
| 1 | A skill nobody asked about is "not assessed", with a reason, never L1 | P0-1, P1-3, P1-4 | 3 |
| 2 | Evidence quotes must be what the candidate said; if none are, confidence drops | P1-5 | 3 |
| 3 | Fit/gap treats an unassessed skill as an unknown, not a gap | P1-1 | 4 |
| 4 | One company can't read or change another's data | P0-2 | 1, 8 |
| 5 | Passwords, notes, names and tokens stay out of the request log | P1-7 | 6 |
| 6 | One fit/gap job per report, however often it's asked for | P1-6 | 7 |

---

## 1. "Not assessed" instead of L1

**Problem (P0-1).** When the model couldn't rate a skill (it answered `null`, `0` or `"N/A"`), the generator clamped
the value into 1..5 and stored **L1**. A skill the interview never reached looked like a measured weakness, and
fit/gap reported it as a gap. Two related defects: a skill the model left out vanished (P1-3), and a failure halfway
through a write deleted the old skills and the assessors' overrides (P1-4).

**Where.**
- [`skill_resolver.rb`](../api/app/services/portfolios/skill_resolver.rb): decides each skill; plain Ruby, no database.
- [`generator.rb`](../api/app/services/portfolios/generator.rb): calls the model and writes the result.
- [Migration `20261016000000`](../api/db/migrate/20261016000000_allow_not_assessed_portfolio_skills.rb): lets a skill
  have no level.
- [`portfolio_skill.rb`](../api/app/models/portfolio_skill.rb): reasons and their labels.

**Step by step, when a session ends.**
1. `PortfolioGeneratorWorker` runs `Portfolios::Generator#call`
   ([generator.rb:23](../api/app/services/portfolios/generator.rb:23)), and the portfolio is marked `generating`.
2. The model is called **before** any transaction opens
   ([:32](../api/app/services/portfolios/generator.rb:32)), so a slow model never holds the database.
3. `parse` ([:54](../api/app/services/portfolios/generator.rb:54)) refuses anything that isn't an object with a
   `configured_skills` array.
4. `SkillResolver#call` ([skill_resolver.rb:30](../api/app/services/portfolios/skill_resolver.rb:30)) handles every
   configured skill, in display order. Each one gets exactly one row:
   1. **Coverage first** ([:68](../api/app/services/portfolios/skill_resolver.rb:68),
      `probed?` [:74](../api/app/services/portfolios/skill_resolver.rb:74)): if the coverage map says the skill was
      never probed (`not_yet`, or no coverage row), the result is `not_reached`, **whatever level the model gave**.
   2. Missing from the model's answer: `omitted_by_model` ([:69](../api/app/services/portfolios/skill_resolver.rb:69)).
   3. **No clamping** (`strict_level`, [:116](../api/app/services/portfolios/skill_resolver.rb:116)). Only a whole
      level from 1 to 5 counts: `3`, `"3"`, `"L3"`, `3.0`. Everything else (`null`, `0`, `6`, `2.5`, `"N/A"`,
      `"high"`, `"L3.5"`) becomes `insufficient_evidence`.
   4. A not-assessed row has no level, no confidence, no summary and no evidence, plus the reason
      ([:111](../api/app/services/portfolios/skill_resolver.rb:111)).
5. **All or nothing** ([generator.rb:36-40](../api/app/services/portfolios/generator.rb:36)): `write_skills` and the
   `complete` status share one transaction. A failure partway leaves the previous skills as they were.
6. `write_skills` ([:70](../api/app/services/portfolios/generator.rb:70)) **updates rows in place**, matched by skill
   identity, so an assessor's override stays on its skill. A skill the model dropped is deleted, unless an assessor
   rated it ([:84-91](../api/app/services/portfolios/generator.rb:84)).
7. **When it fails**, only a category is stored and logged (`model_timeout`, `model_unavailable`,
   `model_invalid_response`, `internal_error`, [:112](../api/app/services/portfolios/generator.rb:112)), never the
   model's text, which could quote the candidate.

**Guard rails (they hold even if the code is wrong).** The migration adds three check constraints:
- the reason is one of the three values;
- a skill has a reason **exactly when** it has no level;
- there's no confidence without a level.

Its rollback counts rows without a level and refuses to restore `NOT NULL` if there are any, rather than invent
values. No existing row changes on the way up.

**Tests.** [`generator_spec.rb`](../api/spec/services/portfolios/generator_spec.rb):
- "deciding what was assessed", AC-1 to AC-12, from :87. Includes "AC-2: discards a level for a skill the interview
  never probed" (:96) and one AC-4 example per junk value (:124).
- "regenerating (AC-8, AC-9)", from :224.
- "model failures (AC-10)", from :257.
- The Step 3 known defects, now passing: P0-1 (:314), P1-3 (:320), P1-4 ×2 (:327, :348).

Elsewhere:
- [`allow_not_assessed_portfolio_skills_spec.rb`](../api/spec/db/allow_not_assessed_portfolio_skills_spec.rb):
  rollback (:30), refusal with counts (:46), reason iff no level (:56).
- [`portfolios_spec.rb`](../api/spec/requests/portfolios_spec.rb): the API says why (AC-19, :23), rating an unrated
  skill needs a note (AC-20, :33), a failed portfolio sends a safe message (AC-21, :54).
- Seeded fault: putting `clamp(1, 5)` back fails 13 specs (`scratch/seeded-fault-clamp`, see the
  [work log](00-work-log.md)).

**Limits.** Past ratings stay as they were. `rake portfolios:unprobed_ratings` counts old L1s that have no probe
behind them, so the team can decide what to do about them. If the coverage analyzer lags one turn, a skill
discussed at the very end can show `not_reached`: the safe direction, visible and fixable with "Add rating".

## 2. Evidence quotes are checked word for word

**Problem (P1-5).** The model's evidence quotes were shown as "from the interview" without being checked. A
paraphrase, or a sentence the interviewer said, could appear as the candidate's words.

**Where.** `verified_quotes` in
[skill_resolver.rb:132-145](../api/app/services/portfolios/skill_resolver.rb:132).

**Step by step.**
1. The resolver is built with **the candidate's turns only** (`speaker: 'candidate'`,
   [generator.rb:65](../api/app/services/portfolios/generator.rb:65)), normalized once
   ([skill_resolver.rb:25](../api/app/services/portfolios/skill_resolver.rb:25)).
2. `normalize` ([:147](../api/app/services/portfolios/skill_resolver.rb:147)) lowercases, makes curly quote marks
   straight and collapses whitespace. Otherwise the match is exact.
3. Each quote is kept only if some candidate turn contains it ([:140](../api/app/services/portfolios/skill_resolver.rb:140)).
   Non-strings, empty strings and duplicates are skipped.
4. Caps: at most 3 quotes, 500 characters each; summaries at 2,000 ([:14-16](../api/app/services/portfolios/skill_resolver.rb:14)).
5. **If no quote survives, the level stays, but confidence drops to `low`**
   ([:100](../api/app/services/portfolios/skill_resolver.rb:100)). A missing quote lowers trust; it never erases a
   rating.

**Tests.** [`generator_spec.rb`](../api/spec/services/portfolios/generator_spec.rb), "evidence (AC-7, AC-11)":
- case, spacing and quote marks are tolerated (:191);
- a quote only the interviewer said is dropped (:199);
- the level is kept with confidence lowered (:205);
- 500 and 2,000 caps (:212);
- known defect P1-5, now passing (:358).

**Limits.** The match is literal, so a quote that drops a filler word ("um") from what was said doesn't count. That's
deliberate: it makes the rule easy to defend, and the cost is a lower confidence, not a lost rating.

## 3. Fit/gap: not assessed is an unknown, not a gap

**Problem (P1-1).** Fit/gap compared every skill's level with the role's expected level. A skill stored as L1
because nobody asked about it showed as "gap −2", and the narrative counted it against the candidate.

**Where.** `build_skill_comparisons` in [engine.rb:41-75](../api/app/services/fit_gap/engine.rb:41).

**Step by step, when fit/gap is generated.**
1. For each skill the vacancy asks for, find the portfolio skill: by `skill_id` first, then by label ignoring case
   ([:94](../api/app/services/fit_gap/engine.rb:94)).
2. The effective level is **the assessor's override if there is one**, otherwise the AI level
   ([:86](../api/app/services/fit_gap/engine.rb:86)).
3. With a level: `delta = candidate − expected`, giving `match`, `exceed` or `gap`. **Without a level: `delta` is nil
   and the result is `not_assessed`** ([:50-57](../api/app/services/fit_gap/engine.rb:50)).
4. The reason travels with it ([:70](../api/app/services/fit_gap/engine.rb:70)): the skill's own
   (`not_reached` and so on), or `not_in_assessment` when the vacancy asks for a skill the interview wasn't set up to
   assess.
5. The payload sends the expected level under both `expected_level` and `required_level`
   ([:63-65](../api/app/services/fit_gap/engine.rb:63)): the web read `required_level` (P1-2), so both stay for one
   release.
6. The narrative prompt says not-assessed skills are "unknowns, not weaknesses"
   ([:136-138](../api/app/services/fit_gap/engine.rb:136)). If the model fails, only the error class is logged
   ([:113](../api/app/services/fit_gap/engine.rb:113)), and the fallback sentence counts unknowns separately
   ([:152-160](../api/app/services/fit_gap/engine.rb:152)).

An assessor can rate a skill the AI didn't. That rating is compared like any other and flagged `is_override`, and it
requires a note ([portfolio_skills_controller.rb:24](../api/app/controllers/api/v1/portfolio_skills_controller.rb:24);
the model validation is in `assessor_override.rb`).

**Tests.** [`engine_spec.rb`](../api/spec/services/fit_gap/engine_spec.rb):
- all four results with the delta (:33);
- "skills that were not assessed": AC-13 ×2 (:98, :105), AC-14 (:109), AC-15 (:117), AC-16 (:123);
- the prompt says "not measured, not weak" (:131);
- the model's text is never logged (:138);
- known defect P1-1, now passing (:151).

**Limits.** The overall narrative is still written by the model; only its prompt and the fallback were changed.
Capping the overall verdict by evidence (Option C) is the next step and needs product sign-off.

## 4. Tenant scoping: one company can't reach another's data

**Problem (P0-2).** Portfolios have no `tenant_id` of their own; they belong to a company through their session.
Five routes looked them up with a plain `Portfolio.find`, so an admin of company B could export, override or run
fit/gap on company A's candidates by changing an ID.

**Where.**
- [`tenant_resolver_middleware.rb`](../api/app/middlewares/tenant_resolver_middleware.rb): sets the company for each
  request.
- [`tenant_scoped.rb`](../api/app/models/concerns/tenant_scoped.rb): default scope for models that have a
  `tenant_id`.
- [`portfolio.rb:24`](../api/app/models/portfolio.rb:24) and
  [`portfolio_skill.rb:18`](../api/app/models/portfolio_skill.rb:18): `for_current_tenant`.

**Step by step, for every request.**
1. The middleware resolves the company ([:33](../api/app/middlewares/tenant_resolver_middleware.rb:33)) from the
   JWT's `scheme` claim, then the `X-Tenant-Scheme` header, then the Referer host, and sets `Current.tenant_id`
   ([:25](../api/app/middlewares/tenant_resolver_middleware.rb:25)).
2. `require_tenant!` ([application_controller.rb:24](../api/app/controllers/application_controller.rb:24)) stops the
   request if no company was found. Only login and the two candidate-link routes skip it.
3. Assessments, sessions and vacancies have a `tenant_id`, and the default scope adds `WHERE tenant_id = …` to
   every query on them.
4. **The fix:** portfolios and portfolio skills are now always looked up through their session's company with
   `for_current_tenant`, a join to `sessions`. This scope **fails closed**: `Current.tenant_id` raises when no
   company is set, rather than returning everything.
5. The lookups that changed:
   - [portfolios_controller.rb](../api/app/controllers/api/v1/portfolios_controller.rb): `regenerate_fitgap` (:82),
     `fitgap` (:106), `show_fitgap` (:135) and `set_portfolio` for export (:161).
   - `set_portfolio_skill` in
     [portfolio_skills_controller.rb:51](../api/app/controllers/api/v1/portfolio_skills_controller.rb:51).
   - Another company's record answers **404**, so its existence isn't revealed either.

**Tests.**
- [`tenant_isolation_spec.rb`](../api/spec/requests/tenant_isolation_spec.rb) (sub-PR 1): the five P0-2 routes
  (:90-128), and the owner can still use each of them (:55-83).
- [`tenant_routes_spec.rb`](../api/spec/requests/tenant_routes_spec.rb) (sub-PR 8) **walks the route table**:
  - "has a case for every API route" (:80) fails when a new route has no case. Routes with no company data are
    listed with a reason (:22).
  - 19 routes are called by company B with company A's IDs; each answers 404 and changes nothing in A's tables or
    the job queue (:91).
  - Lists leave A out (:102), and creates land in B even when the body names A (:115).
  - B's own records can't reach A's nested skills or vacancy (:128).
  - Checked against two faults, then reverted: an unscoped vacancy lookup, and an unlisted route.

**Limits (C2, escalated).** Login takes the company from the `X-Tenant-Scheme` header, and users belong to no
company, so any admin can sign in to company A. The pending case at :171 proves it: 200 where it expects 404.
Fixing it needs a user-to-company link in a database shared with `rakamin-api`; that's a Tech Lead decision, not a
scoping fix. Also, the default scope returns everything when no company is set; `require_tenant!` is what blocks
that at request time.

## 5. Personal data out of the request log

**Problem (P1-7).** Rails logs every request's parameters. Login passwords, assessor notes, candidate names and the
invite token (all it takes to join a candidate's interview) were written to the log in plain text.

**Where.**
[`filter_parameter_logging.rb`](../api/config/initializers/filter_parameter_logging.rb):

```ruby
passw email secret token _key crypt salt certificate otp ssn cvv cvc
assessor_notes candidate_name
```

**Step by step.**
1. Rails replaces the value of any parameter whose name **contains** one of these with `[FILTERED]` before it logs
   the request.
2. Because the match is partial, `token` also covers `invite_token` and `auth_token`, and `passw` covers `password`
   and `password_confirmation`.
3. The first line is Rails' default list; the second is ours: what an assessor writes about a candidate, and who the
   candidate is (personal data under UU PDP).

The model-reply log lines were fixed in sub-PRs 3 and 4 (sections 1 and 3): they log a category or class, never the
reply, which can quote the candidate.

**Tests.** [`parameter_logging_spec.rb`](../api/spec/requests/parameter_logging_spec.rb) sends real requests and
reads what Rails would log:
- password and email at login (:13);
- assessor notes, while `override_level` stays visible (:23);
- candidate name on an invite (:35);
- invite token in the URL (:45).

The pending P1-7 example in `authentication_spec.rb` passes now.

**Limits.** This covers request parameters only. One error log on this path still includes `e.message`:
[fit_gap_generator_worker.rb:16](../api/app/workers/fit_gap_generator_worker.rb:16). Today it can't carry the model's
reply, because the engine rescues those errors itself, but it's the next line to tighten. The audio WebSocket
middleware also logs error messages; that path wasn't part of this change.

## 6. One fit/gap job per report

**Problem (P1-6).** Each fit/gap request, or a page polling for a result, queued a new job. Concurrent jobs then
crashed on the unique index for (portfolio, vacancy), and paid model calls were wasted.

**Where.**
- [`fit_gap_report.rb`](../api/app/models/fit_gap_report.rb): `claim` (:23-35).
- [Migration `20261017000000`](../api/db/migrate/20261017000000_add_generation_status_to_fit_gap_reports.rb): adds
  `generation_status` (`generating` or `complete`, existing rows become `complete`) and `requested_at`.

**Step by step, when fit/gap is requested.**
1. `POST /portfolios/:id/fitgap` ([portfolios_controller.rb:105](../api/app/controllers/api/v1/portfolios_controller.rb:105)):
   if a complete report exists, return it (200).
2. Otherwise `FitGapReport.claim` ([fit_gap_report.rb:23](../api/app/models/fit_gap_report.rb:23)) **inserts a
   `generating` row first**. The unique index on (portfolio_id, vacancy_id) is now **the lock**: of two concurrent
   inserts, one fails.
3. The insert that wins returns true, and only that request queues `FitGapGeneratorWorker`. Every caller gets 202.
4. The losing insert raises `RecordNotUnique`. It may take over the row only if the claim is **stale**: older than
   `CLAIM_STALE_AFTER = 10.minutes` ([:9](../api/app/models/fit_gap_report.rb:9)), longer than a job and its two
   retries, so it belongs to a job that died. The takeover is one conditional `UPDATE … WHERE generation_status =
   'generating' AND requested_at < …`, and Postgres lets only one caller match it ([:30-34](../api/app/models/fit_gap_report.rb:30)).
5. Regenerate and a new override call `claim(replace: true)`, which may also take over a `complete` row. The row is
   reused, not deleted ([portfolio_skills_controller.rb:41](../api/app/controllers/api/v1/portfolio_skills_controller.rb:41)).
6. The job runs `Engine#call`, which updates the same row to `complete` and clears `requested_at`
   ([engine.rb:21-33](../api/app/services/fit_gap/engine.rb:21)).
7. Show, JSON export and PDF read only **complete** reports, so a claim in progress is invisible. The web keeps
   getting 404 while it polls, exactly as before, so the web needed no change.

**Tests.** [`fit_gap_spec.rb`](../api/spec/requests/fit_gap_spec.rb), "one job per report (P1-6)":
- one job while a report is being generated (:50);
- the claim is hidden until the job writes the report (:58);
- a dead job's claim is taken over (:74);
- repeated regeneration queues one job (:84);
- only one of two claims wins (:96).

The P1-6 spec pending since Step 3 (`expected: 1, got: 2`) passes now.

**Limits.**
- The "two claims" spec runs them one after the other, not in parallel threads; the guarantee comes from the unique
  index and the conditional update, both enforced by Postgres.
- If an override lands while a job is already running, no second job is queued, so that report may miss the override
  until the next regenerate. A version counter on the claim would close it.
- The four specs after the first were written with the fix, so they weren't run against the old code.
