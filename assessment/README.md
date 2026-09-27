# Assessment deliverables

Written deliverables for the Fullstack Product Engineer case study. Code changes are in `api/` and `web/`.

| Document | What it covers |
|---|---|
| [report.md](report.md) | The full narrative, Steps 1 to 5: context, severity-ranked findings, revamp strategy, execution proof |
| [acceptance-criteria.md](acceptance-criteria.md) | Behaviour defined before implementation, with every later addition dated |
| [options-comparison.md](options-comparison.md) | Technical options compared for each open decision |
| [decisions-log.md](decisions-log.md) | What was decided, what was rejected and why |
| [evidence/](evidence/) | Seeded-fault proof: the red run and the green run after the revert |

**Branches:** `feat/interview-failure-visibility` (this PR) · `scratch/seeded-fault-duplicate-skills` (seeded fault, not for merge)

**Run the tests**
```bash
cd api && bundle exec rails db:migrate && bundle exec rspec
cd web && npm install && npx tsc --noEmit && npm test
```
