# Seeded fault test

Proof that the tests are real: each fix was reintroduced as a fault, the suite
was run, the failure captured, and the fault reverted. History on
`scratch/seeded-fault` is intentionally unsquashed.

## Executed here (frontend)

| # | Fault reintroduced | Caught by | Evidence |
|---|---|---|---|
| 1 | `required_level` made optional in the Zod schema — the exact condition that let the original contract bug through | `schemas.test.ts` — 2 failures, `Received: undefined` | `seeded-fault-1-contract.txt` |
| 2 | `not_assessed` restyled amber, identical to a gap | `ComparisonTable.test.tsx` — 1 failure | `seeded-fault-2-not-assessed-styling.txt` |

Fault 2 is the one worth noting: it produces no type error and no runtime
error. It is a one-token change that silently converts "we never asked" into
"they cannot do it" on a hiring report. Only an assertion about intent catches
it, which is why the assertion is written about the *meaning* of the colour
rather than its value.

After reverting both: **23 passed, 0 failed.**

## To run on a machine with the Rails stack

The backend suite could not be executed in the authoring environment (Ruby
3.0.2 against the repo's 3.3.2, no bundler, no PostgreSQL). Each fault below is
a one-line revert; run, capture, revert.

| # | Fault to reintroduce | File | Must be caught by |
|---|---|---|---|
| 3 | `ai_level: skill_data['level'].to_i.clamp(1, 5)` | `services/portfolios/response_contract.rb` — replace `parse_level` with `raw.to_i.clamp(1,5)` | `generator_spec` "never as L1" (3 examples) |
| 4 | `portfolio.portfolio_skills.destroy_all` before the upsert | `services/portfolios/generator.rb#persist!` | `generator_spec` "survives regeneration" |
| 5 | Drop the `ActiveRecord::Base.transaction` wrapper | `generator.rb#persist!` | `generator_spec` "rolls back completely" |
| 6 | `Portfolio.find(params[:id])` in place of `for_current_tenant` | `portfolios_controller.rb` | `portfolio_tenant_isolation_spec` — 4 examples |
| 7 | Emit `expected_level` only, dropping `required_level` | `fit_gap/engine.rb#comparison_for` | `engine_spec` "emits required_level" |

```bash
cd api
git checkout -b scratch/seeded-fault-backend
# apply fault, then:
GEMINI_STUB=true bundle exec rspec 2>&1 | tee ../assessment/test-evidence/seeded-fault-N.txt
git checkout <file>   # revert, keep the branch history
```
