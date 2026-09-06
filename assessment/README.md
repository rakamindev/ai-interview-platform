# Case Study — Fullstack Product Engineer

**Candidate:** Zindu Pratama
**Submitted:** 7 September 2026

**Pull request:** https://github.com/rakamindev/ai-interview-platform/pull/116
*(open, not merged — merging requires write access this fork does not have)*

**Video walkthrough:** https://youtu.be/ZpNXkTW_4Dc

---

## The change, in one line

> The fit/gap report is where this product throws away its own evidence.
> This restores it, closes a proven cross-tenant data leak found on the way, and
> adds the test harness and CI the repository had none of.

---

## Read in this order

| | Document | Covers |
|---|---|---|
| 1 | [`02-context-and-domain.md`](02-context-and-domain.md) | **Step 2** — the product, the industry, what it is for, the users, and the candidates who never chose it, with UU PDP mapped to specific code |
| 2 | [`03-problem-and-gap.md`](03-problem-and-gap.md) | **Step 3** — the core problem, a self-derived severity rubric, 13 findings ranked P0–P3 with impact statements, missing spec vs defect, and 5 constraint signals |
| 3 | [`04-strategy-and-tradeoffs.md`](04-strategy-and-tradeoffs.md) | **Step 4** — three options evaluated on impact, cost, maintainability, failure modes and contextual fit; 23 self-derived acceptance criteria; trade-offs accepted |
| 4 | [`05-execution-proof.md`](05-execution-proof.md) | **Step 5** — coverage evidence, the seeded fault test, data safety, AI verification moments, engineering depth claimed |
| — | [`pull-request-body.md`](pull-request-body.md) | The PR description, kept here so the reasoning travels with the code |
| — | [`ai-verification-log.md`](ai-verification-log.md) | Five occasions where AI output was wrong or risky, recorded as they happened |
| — | [`assumptions.md`](assumptions.md) | Eleven documented ambiguities and the assumption taken for each |
| — | [`evidence/`](evidence/) | Captured failing output from the seeded fault test |
| — | [`screenshots/`](screenshots/) | Before and after, including edge cases, error states and responsive views |

---

## Summary of results

| | Before | After |
|---|---|---|
| RSpec | 0 examples (no `spec/` directory) | **27** |
| Vitest | no test runner | **25** |
| CI | none | 2 jobs, incl. migration-reversibility assertion |
| P0 findings | 3 present, 0 known | 3 found, **3 fixed** |
| Findings total | — | **13 documented, 11 fixed, 2 escalated by choice** |
| AI verification moments | — | **5**, written as they happened |

---

## The three findings that mattered most

**The Required column was blank on every row.** The API sends `expected_level`;
the UI declared `required_level` as a required field and read it. TypeScript
reported no error because responses are cast rather than validated at the axios
boundary. The same payload renders correctly in the PDF export — one payload, two
renderers, one broken.

**A human override was applied and invisible.** An assessor had corrected
Communication from the model's L2 to L3 with a written justification. The engine
used the correction; the table showed no trace of it, while its own legend
promised a marker the payload could never trigger.

**Any assessor could read and rewrite another organisation's candidate data.**
Found while writing specs for something else, proven with a request spec —
`HTTP 201 Created` on a cross-tenant override, and a JSON export leaking a
candidate's name and verbatim interview quotes — and only then escalated from P1
to P0 and fixed.

---

## What was deliberately left undone

Three constraint signals are reported rather than patched, each argued in
`03-problem-and-gap.md` §6:

- **CS-1** — tenant isolation is still enforced by controller discipline rather
  than at the data layer. The endpoints that leaked are closed; the class of bug
  is not.
- **CS-2** — `advance_stale_partials` silently redefines what "covered" means,
  which becomes `confidence: high` and can end an interview early. A product
  decision, not an engineering patch.
- **CS-4** — the frontend still trusts the API contract with no runtime
  validation. This is the root cause of the P0 above, and the recommended next
  change.

Also untouched: the AI interviewer's probing behaviour (PRD-01). It cannot be
asserted on by a test, and a change nobody can verify is not a change worth
shipping under a deadline.
