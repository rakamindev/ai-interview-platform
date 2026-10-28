# Step 5: Implementation and proof

Branch `feat/candidate-assessment-revamp`, one PR across `api/` and `web/`. Every change below was
written test-first: the spec was run and seen failing before the code changed (red and green
output for each group is in `evidence/tests/`).

## 1. What changed

| Area | Change | Findings |
|---|---|---|
| Tenancy | `Portfolio.in_current_tenant` / `PortfolioSkill.in_current_tenant` (join through `Session`, whose default scope applies inside the join) used by every id-based lookup | F1 |
| Data model | `portfolio_skills.assessment_status` (`assessed`, `not_assessed`, `needs_review`) and `status_reason`; level and confidence nullable; two check constraints: a level exists exactly when the skill is assessed, and an unassessed skill has no confidence. `fit_gap_reports.rules_version`; `portfolios.generation_attempts` / `generation_started_at`; `assessor_overrides.ai_level` nullable | F2, F6 |
| Generator | Skill list comes from the coverage map; no model call when nothing was discussed; one normalizer per skill (never raises, unusable level becomes `needs_review`); confidence from the PRD rule; in-place upsert in a savepoint with a row lock, so overrides survive; readable failure reasons, `failed` only when retries run out | F2, F4, F5, F6, N4 |
| Fit/gap | Unmeasured skills are `not_assessed` / `needs_review`, never a gap; `provisional` for low confidence; `overridden` and `ai_level` on each row; narratives built from competency summaries (PRD-02) and told that unmeasured skills are not weaknesses; a serializer with defaults for stored reports, `stale` / `outdated` / `generating` flags; a Redis lock so one (portfolio, vacancy) runs once; reports are kept, not deleted, during a refresh | F2, F3, F7, F8, F9 (partial) |
| Overrides | Notes capped at 2,000 characters; a note is required when the skill was not assessed | AC6 |
| Export | Noto Sans (OFL) instead of Windows-1252 built-ins; overrides described in words; PDF table marks provisional and assessor-set results and labels AI text as a draft | F10 |
| Logging | `filter_parameter_logging`: passwords, tokens, emails, candidate names, assessor notes, transcript text | N1 |
| Web | Types match the contract; table, cards, override form, both pages rewritten for every state; one fit/gap request then polling; mobile layout; `Notice` component | F3, F7, F11, F12 |
| Harness | RSpec (factories, tenancy helpers, a guard against real model calls), Vitest + Testing Library, GitHub Actions for both, shared contract file | constraint signal 4 |

Size: 44 product files changed (+1,976 / -565), 29 test and contract files added (+2,072).

## 2. Acceptance criteria to tests

| Criterion | Proved by |
|---|---|
| AC1 unmeasured skills are "Not assessed" everywhere | `generator_spec` (never rates `not_yet`, no model call without answers or coverage), `skill_normalizer_spec`, `engine_spec` (`not_assessed`, never a gap), `portfolio_pdf_export_spec` (level line), `SkillPortfolioCard.test`, `ComparisonTable.test`, `PortfolioPage.test` |
| AC2 bad model output contained per skill | `skill_normalizer_spec` (33 examples: level, evidence, summary shapes), `generator_spec` (matching by id in any case and by label, skipped / invented / duplicate skills, unreadable response, failure halfway leaves old rows) |
| AC3 confidence by PRD rule | `confidence_spec` (table of states and probe counts, overlaps), `generator_spec` ("High" no longer crashes) |
| AC4 honest fit/gap | `engine_spec` (provisional, override flag, rules version, summaries in prompt), `report_serializer_spec` (contract keys, legacy rows, stale, outdated), `ComparisonTable.test` (renders the contract file) |
| AC5 tenant isolation | `portfolio_tenant_isolation_spec` (each endpoint with another tenant's ids, own ids still work), `portfolio_tenant_scope_spec` (workers still see rows) |
| AC6 overrides never lost, validated | `generator_spec` (in-place update keeps overrides), `portfolio_skill_override_spec` (levels, length, note required, report kept), `OverridePanel.test` |
| AC7 one job at a time | `fit_gap_generation_spec`, `fit_gap_generator_worker_spec` (lock released on success and failure), `portfolio_generation_status_spec` (409 while running), `portfolio_generator_worker_spec`, `useFitGapReport.test` |
| AC8 stalled runs recoverable | `portfolio_generation_status_spec` (stale after 20 min, second click after queueing is refused), `PortfolioPage.test` |
| AC9 export works and fails visibly | `portfolio_pdf_export_spec` (override, Indonesian, Greek, Cyrillic, CJK, emoji, 5,000-char summary), `PortfolioPage.test` (export error) |
| AC10 no sensitive data in logs | `filter_parameter_logging_spec` |
| AC11 UI states | `PortfolioPage.test`, `SkillPortfolioCard.test`, `OverridePanel.test`, plus a manual check at 1280 px and 375 px (screenshots) |

Totals: **151 RSpec examples, 33 Vitest tests, all passing**; `tsc` and `vite build` clean. CI
workflow added; it has not run on GitHub yet because nothing has been pushed.

## 3. Proof that the tests are real

- **Red before green.** Every group's failing run is saved next to its passing run in
  `evidence/tests/`.
- **Seeded fault test** (branch `scratch/seeded-fault`, reverted with `git revert`, history kept):
  removing the not-assessed rule broke 13 specs (`2b67f0b` / `c15c80d`), with 9 of them stopped by
  the model's own validation, a second line of defence; dropping the tenant scope on export broke
  the two cross-tenant export specs (`3c788f2` / `55382aa`); re-requesting fit/gap on every poll
  broke two hook tests, "called 3 times" (`c6dfe72` / `68178bb`).
- **Runtime re-checks** with real Gemini after each backend group (`evidence/B-after-*.txt`): the
  dropped-audio candidate now gets "not assessed" on every skill and "a comprehensive hiring
  recommendation cannot be made"; three fit/gap requests run one job; cross-tenant calls return
  404; the PDF with an override and non-Latin text renders, checked by rendering it to an image.
- **Migrations** run up, down and up on the dev data, and the down migrations refuse, with a
  message, to invent levels for rows that have none.

## 4. AI verification moments

Nine real entries in `ai-verification-log.md`. The two that matter most:

1. **The error path saved a half-written skill** (#4). My first generator built new skills through
   the association; when a save failed, the existing `rescue` called `portfolio.update!`, which
   autosaved the unsaved skill outside the rolled-back transaction: exactly the partial write this
   change was meant to remove, and it would have happened in production. Caught by the AC2.9 spec,
   diagnosed by printing the surviving rows rather than guessing.
2. **A wrong explanation** (#3). I first blamed nested transactions and wrote that a value had
   changed when it had not. Re-reading my own log, I tested the claim (removed `requires_new`, all
   specs passed) and corrected the entry and the code comment in a separate commit.

Others: a zsh quirk that made every model look like a 404 (#1); trusting a model metadata
endpoint (#2); a regenerate endpoint that made every just-queued run look stalled (#5, caught by
reading my diff before commit, spec written first); two wrong test expectations corrected without
weakening them (#6); a "missing name" that was a screenshot taken mid-load (#7); a fake test password that GitGuardian
flagged on the PR (#8); a lock that any job could release (#9, now token-owned).

## 5. Engineering choices worth defending

- A status column with database constraints instead of omitting rows or a sentinel level: the
  honest state is enforced by the database, not by remembering to check.
- Tenant scope through the parent now, `tenant_id` on child tables later: closes the P0 without a
  production data migration; the specs pin the behaviour for the follow-up.
- Model output treated as untrusted input at one boundary (the normalizer), whatever the prompt
  or the model promises.
- One contract file read by both test suites, so the API and the UI cannot drift silently again.
- A Redis lock taken at enqueue time, released by the worker, with a TTL for dead workers.

## 6. Limits and what was deferred

- **Not done:** consent notice, retention and deletion (F9); the scheme-less token path (N3);
  `tenant_id` on child tables; evidence grounding (checking quotes appear in the transcript);
  a backfill task for portfolios generated before this change (they show as stale or keep their
  old L1 until regenerated); line-level coverage measurement.
- **Not tested here:** the live audio interview (seeded transcripts were used, see Step 3); CI on
  GitHub; production model ids (local runs used `gemini-2.5-flash`).
- **Still true after the change:** the model writes a hiring recommendation. It is now labelled as
  a draft and no longer built on unmeasured skills, but whether the product should write one at all
  is a product and legal decision (Pasal 10 UU PDP), escalated rather than decided here.
