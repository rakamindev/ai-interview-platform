# 04 · Verification

> Brief Step 5: proven correctness, a seeded fault test, and the AI verification moment (`ai-notes.md`). Raw outputs are in `assessment/evidence/`.

## 1. Test suites

| Suite | Count | Runs with | Covers |
|---|---|---|---|
| API (RSpec) | **121 examples** | `cd api && bundle exec rspec` | rating parser, skill reconciler, generator (incl. failure paths), evidence gate, fit/gap engine, request specs (contract, tenant isolation, regenerate idempotency), PDF content, model and DB constraints |
| Web (Vitest + Testing Library) | **44 tests** | `cd web && npm test` | level helpers, `LevelTrack`, `LevelBadge`, skill card (not assessed, rate manually, save error, low confidence, long text), `LevelRadio` independence, comparison table, evidence-gap notice, both pages in every state |

Neither suite makes network calls. The API blocks all outbound HTTP (WebMock) and injects a fake Gemini client; the web tests mock the API services.

## 2. Seeded fault test

**Branch:** `scratch/seeded-fault`. History:

```
a015f4f Revert "test: seed faults to prove the suites catch regressions (do not merge)"
35ea09b test: seed faults to prove the suites catch regressions (do not merge)
cd7b6b7 docs: record frontend design decisions and visual verification   ← feature branch tip
```

**Faults seeded** (`35ea09b`), both copied verbatim from the original code:

| Side | Fault |
|---|---|
| API | `RatingParser.level` returns `value.to_i.clamp(1, 5)`, the original generator line that turned `null`, `"N/A"` and `"L3"` into L1 |
| Web | `ComparisonTable` reads `required_level`, the field the API never sends (the blank "Required" column) |

**Result with faults** (`evidence/seeded-fault-api.txt`, `evidence/seeded-fault-web.txt`):

| Suite | Result | Where |
|---|---|---|
| API | **121 examples, 33 failures** | 24 in `rating_parser_spec.rb`, 9 in `skill_reconciler_spec.rb` |
| Web | **1 failed, 43 passed** | `ComparisonTable › shows the required level from expected_level`: *"Unable to find an element with the text: L4"* |

**Result after revert** (`a015f4f`; `evidence/after-revert-*.txt`): API 121 examples, 0 failures; web 44 passed. The reverted tree is byte-identical to the feature branch (`git diff feat/honest-skill-evaluation -- api web` is empty).

**Observation: defence in depth.** With the parser broken, the generator's integration spec *still passed*. The reconciler's second rule, that a level needs at least one candidate quote, recorded the invented L1 as not assessed anyway. The two guards fail independently, so either one alone is enough to stop the original "missing evidence becomes L1" defect.

## 3. Mutation checks during development

Beyond the formal seeded fault, each critical rule was broken on purpose while it was being built, to confirm its tests fail. The file was then restored:

| Mutation | Tests that failed |
|---|---|
| Reconciler: drop "level needs evidence" | 2 (reconciler AC1) |
| Generator: remove the transaction | 1 (half-written save keeps previous skills and override) |
| Generator: mark `failed` on every attempt (the original behaviour) | 3 (status stays `generating` while Sidekiq retries) |
| Evidence gate: always `sufficient` | 6 |
| Engine: treat a missing level as L1 | 4 |
| `LevelRadio`: back to shared `level-N` ids | 1 |
| `levelLabel`: fall back to "L1" | 6 |
| Fit/gap page: no polling timeout | 1 |

Tests written before the fix also failed against the original code, which proves the defects were real:
- the 4 cross-tenant request specs (F-003);
- 3 PDF specs raising `Prawn::Errors::IncompatibleStringEncoding` (F-011).

## 4. Migration safety

`20261020000000_allow_not_assessed_skill_ratings`, checked on the development database, which holds real rows from two live sessions:

1. `up` → `down` → `up` all succeed. The `schema.rb` diff contains only the intended changes.
2. With a not-assessed row present, `down` backfills it to the old forced values (`1 / low / ''`) and restores the constraints; migrating forward again works. The first version of `down` failed this check (AI note #6) and was fixed.
3. A half-set rating (level without confidence) is rejected by the database itself (`chk_portfolio_skills_rating_complete`), even when model validations are bypassed. This is covered by a spec.

## 5. API checked against the demo seed

`rails demo:seed_report` builds fictional sessions covering every state. Each was checked through the running API:

| Session | Portfolio | Fit/gap |
|---|---|---|
| Mixed | complete: 4 assessed, Cloud not assessed | `insufficient_evidence`: Cloud not assessed, TypeScript low confidence |
| Fully evidenced (+1 override) | complete | `sufficient`, narratives present |
| Candidate left early | all 4 not assessed | `insufficient_evidence`: all skills, plus `interview_incomplete` |
| Generating | `202 generating`, `last_error: "Rate limited"` | — |
| Failed | failed with reason | — |
| Still in progress | `not_ready` | — |
| Mixed vs empty vacancy | — | `insufficient_evidence`: `no_vacancy_skills` |

## 6. Visual verification

Both pages were opened in a real browser at 1280 px and 390 px. Three layout defects were found and fixed (AI note #7). After the fixes, `scrollWidth` equals the viewport width at 390 px, and no element overlaps another.

## 7. Live end-to-end interview

*Not run before submission:* the Gemini free tier (20 requests a day per model) ran out. Session 1, a real interview recorded before the fix, had its fit/gap report regenerated by the new code (`assessment/screenshots/before/`). Planned run, for when quota allows: a 10-minute interview with three configured skills, deliberately avoiding one. Confirm that "Not assessed" is consistent across the database, API, portfolio, fit/gap and PDF, then override it and confirm the fit/gap report updates.
