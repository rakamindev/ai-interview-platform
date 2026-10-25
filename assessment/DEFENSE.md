# Prepare to defend the work

This guide is for Dixon to study and rewrite in his own words. It is not a claim that he has already independently implemented or mastered every change. The report and video disclose AI assistance.

## A two-minute explanation

The original comparison hid the required level because backend and frontend used different field names. More seriously, missing evidence, human revisions, and stale results were not handled consistently. I chose the portfolio-to-vacancy review because it is where someone turns interview evidence into a consequential decision.

The change keeps the existing stack and makes the comparison deterministic. Each requirement shows its expected level, effective rating, source, evidence, and delta. No usable rating means not assessed, not L1 and not a demonstrated gap. A human revision retains the AI level from the time of review. A missing interview signal is a reason to follow up.

The API explicitly checks the owning session's tenant and the vacancy tenant. A report has persisted lifecycle state, a source digest, a generation token, and a two-minute lease. A shared portfolio row lock coordinates requests, workers, and human revisions. Refresh failures preserve the last successful snapshot, and exports require current inputs.

The most significant product trade-off is replacing unsupported culture/hiring narratives with a reproducible evidence summary. The biggest reliability trade-off is bounded lease recovery rather than a transactional outbox. Explain why these fit a four-day scope, then demonstrate the tests and the fault/revert history.

## Trace these files yourself

| Question | Read and explain |
| --- | --- |
| Why did Required disappear? | `api/app/services/fit_gap/engine.rb`, `web/src/types/index.ts`, `ComparisonTable.tsx` |
| Why is nil different from L1? | `FitGap::Snapshot.level`, `Portfolios::Generator#save_skills`, and their specs |
| How do canonical and custom skills match? | `FitGap::Snapshot#rating_for` and duplicate-label/ambiguous-rating specs |
| What changes after a human revision? | `PortfolioSkillsController#override`, `AssessorOverride`, snapshot provenance and digest |
| How are duplicate jobs handled? | `FitGap::RequestGeneration` and `FitGapGeneratorWorker` |
| What if the process dies after DB commit but before Redis enqueue? | Two-minute timeout detection, explicit reviewer retry, and the deferred outbox decision; no automatic re-enqueue |
| What if a provider returns two valid skills and one invalid skill? | The portfolio lock/transaction and partial-write rollback test |
| How do you deny another tenant's report/export/override? | Owned-portfolio/session joins and negative request specs |
| How do you know a report is stale? | Snapshot digest, version constant, `FitGapReport#review_status`, export guard |
| What if the UI is offline? | Page loading/action errors, bounded polling, saved snapshot, Check status |
| Why did local PDF tests differ from CI? | WSL bind-mount file events left stale code in one process; polling and a clean restart fixed it |
| What can you not claim? | No live Gemini interview, production load test, whole-product privacy certification, or measured hiring outcome |

## Practice with examples

1. Required L4, AI L2, human L3: effective L3, gap -1, source human, original AI L2.
2. Required L3 and no rating: not assessed, no delta, follow up; never infer L1.
3. Same label but different canonical IDs: do not match them.
4. Two ambiguous ratings for one identity: do not select an arbitrary winner.
5. Stale source inputs: preserve the old snapshot, mark it previous, block comparison export, refresh explicitly.
6. Redis enqueue fails: persist a safe failure, retain previous content, allow retry.
7. A duplicate/old token arrives: do not overwrite newer work.

## Demonstrate the proof

Run the backend suite, frontend tests/build, and browser checks from RUNBOOK.md. Open the scratch branch commits `1ca12dc` and `1426ef5`. Explain why addition instead of subtraction caused 28 of 35 comparison examples to fail. Show that the feature branch contains the correct subtraction and the final suite passes.

For AI verification, explain the generated evidence-selector correction and the limits of its Enter-key assertion. Explain the dependency review and final versions, but do not assert exact historical advisory details: the initial full audit output was not retained. Be prepared to explain generated code without relying on AI during the interview.

## Before the portal upload

Open the final PDF and every external link in a signed-out browser. Watch the 3:30 captioned video. Confirm the dashboard's exact due date/time. Review the PR diff, especially failure paths and tenant checks. Upload the single PDF through the hiring dashboard; the report contains the code and video links.
