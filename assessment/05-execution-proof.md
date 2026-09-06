# Step 5 — Monozukuri Execution Proof

## 1. What shipped

19 commits on `feat/evidence-aware-fit-gap`, 49 files. Small and readable by
layer: the harness lands before the fix that depends on it, and each commit
message argues its own change rather than describing it.

| Layer | Change |
|---|---|
| Data model | One migration — `narrative_degraded` on `fit_gap_reports` |
| API | Evidence provenance in the fit/gap payload; degraded-narrative tracking; empty-vacancy handling; tenant-scoped portfolio lookups |
| Frontend | Comparison table rebuilt around evidence; confidence rendered verbatim; page self-contradiction resolved; quotes normalised; responsive shell |
| Tests | RSpec and Vitest harnesses built from nothing |
| CI | Both suites, typecheck, and a migration-reversibility assertion |
| Repo | Env-ignore hardening, stale setup docs, a seedable assessor account |

---

## 2. Test coverage

The repository had **RSpec in the Gemfile with no `spec/` directory**, **no test
runner in `web/package.json`**, and **no CI**.

| | Before | After |
|---|---|---|
| `api/` | 0 examples, no `spec_helper` | **27 examples** across 2 spec files |
| `web/` | no runner at all | **25 tests** across 2 test files |
| CI | none | 2 jobs — RSpec, typecheck, Vitest, migration rollback |
| **Total** | **0** | **52** |

### What the 27 API examples cover

`spec/services/fit_gap/engine_spec.rb` (20) — the full comparison matrix
(match / gap / exceed), override precedence over the model level, `skill_id`
matching ahead of label, case-insensitive label fallback, unassessed
requirements, evidence provenance and counts, model-call failure and the
degraded flag, fallback pluralisation in both branches, idempotent regeneration,
a vacancy with no skills, and a 4 000-character summary.

`spec/requests/api/v1/tenant_isolation_spec.rb` (7) — cross-tenant override
writes, cross-tenant JSON export including its personal-data payload, a
positive control that the owning tenant is not blocked, and a control confirming
the session-scoped path was already protected.

### What the 25 web tests cover

`ComparisonTable.test.tsx` (13) — required level rendered on every row type,
evidence strength distinguishing a 3-quote match from a 1-quote match, override
marking and the superseded level, unassessed rows never presented as gaps and
counted in the summary, the empty state, a very long label, and delta signs.
**Fixtures are transcribed from a real N13 response**, not written to match the
component — a fixture shaped to the component's expectations would have hidden
the very defect it exists to pin down.

`evidence.test.ts` (12) — one layer of quote stripping and no more, across
straight, curly and single pairs, interior quotes, whitespace, a lone quotation
mark, the empty quote, and mixed nesting.

### Watching them fail first

Each fix was preceded by a red run, not followed by a green one:

- The first `engine_spec` run: **19 examples, 8 failures** — `is_override`,
  `ai_level`, `evidence_count` and `narrative_degraded` all absent.
- The first `ComparisonTable` run: **13 tests, 9 failures** — driven by fixtures
  carrying `expected_level`, the key the component did not read.
- The first `tenant_isolation_spec` run: **7 examples, 4 failures**, with the
  captured `HTTP 201 Created` on a cross-tenant override.

---

## 3. Seeded fault test

Branch `scratch/seeded-fault` · captured output
`assessment/evidence/seeded-fault-test.txt`

Three minimal, plausible regressions — the kind a careless refactor produces,
not syntax errors that fail to compile — introduced together, then reverted with
the history left visible.

| Fault | Caught by |
|---|---|
| Drop `is_override` from the serialised comparison | 2 RSpec examples |
| Read `required_level` again instead of `expected_level` | 3 Vitest tests |
| Remove the loop guard so one layer is stripped *per quote pair type* | 1 Vitest test |

**6 failing examples across both suites.** History: the fault commit, then
`Revert "test: SEEDED FAULT …"`, both preserved.

### The honest part

The third fault was **not caught on the first attempt**. Every existing example
nested a single quote pair, and the stripping loop advances to a *different* pair
rather than retrying the same one — so `"…"` behaved identically with and without
the guard, and only `"“…”"` distinguished them. The suite was green while real
behaviour had changed.

The exercise found a hole in the tests rather than demonstrating their strength,
which is the more valuable outcome and the reason the brief asks for it. The
missing example was added (`test(web): cover mixed quote nesting`) before the
evidence was recorded, and the fault then failed as intended.

---

## 4. Data safety

**Migration.** `add_narrative_degraded_to_fit_gap_reports` — reversible
(`add_column` inside `change`), safe against existing rows (`default: false`
backfills so `null: false` holds immediately), and O(1) on PostgreSQL 11+, which
stores a non-volatile default as catalog metadata rather than rewriting the
table. `false` is the honest value for reports generated before the distinction
existed. Verified locally by `db:rollback STEP=1` followed by `db:migrate`, and
**CI asserts the same on every pull request** so a future irreversible migration
fails review rather than production.

**Authorisation.** The cross-tenant P0 was proven with a request spec before
being fixed, and the fix is covered by 7 examples including positive controls.

**Personal data.** No real candidate data enters the repository — factory data is
fictional by construction. No secrets are committed: the env-ignore rule was
widened from `**/.env` to `**/.env.*` after a near-miss (VER-03), and
credential-shaped literals were purged from CI history after GitGuardian flagged
them (VER-05). Service logs were checked for personal data; `[N13]` and
`[N10]` log identifiers and error classes, not transcript content.

---

## 5. AI verification moments

Five recorded in `ai-verification-log.md`, each written when it happened rather
than reconstructed afterwards. Summarised:

| | What went wrong | How it surfaced |
|---|---|---|
| **VER-01** | An install command correct for vanilla Arch would have swapped this machine's compression library, breaking ~120 packages | Running it and reading the refusal instead of retrying past it |
| **VER-02** | A pluralisation helper produced "3 skill meetss", and the AI-written spec asserted only the singular branch so the suite stayed green | Reading real generated output, not the test suite |
| **VER-03** | `cp web/.env web/.env.bak` created a credential file the `.gitignore` did not match; `git add -A` would have staged it | A pre-commit check on what would actually be staged |
| **VER-04** | A responsive fix declared complete on the strength of a jsdom suite that performs no layout — and applied to the wrong layer entirely | Opening the app in a real browser at a phone width |
| **VER-05** | Credential-shaped literals in CI, then a confident and wrong argument that fixing forward would clear the scanner | The scanner failing a second time, still naming the original commit |

The through-line is one thing said five ways: **a claim is worth what its
evidence is worth, and the AI is fluent enough to make an unevidenced claim sound
finished.** VER-04 and VER-05 are the two I would put in front of a reviewer,
because in both the AI produced a coherent argument for a wrong conclusion, and
in both what settled it was a measurement rather than a better argument.

---

## 6. Engineering depth claimed

Stated precisely, so it can be checked rather than taken on trust:

- **A P0 contract defect at the computation/presentation seam**, diagnosed from
  the live payload and the source of two renderers that disagree, fixed on the
  side that deviated from the domain vocabulary.
- **A P0 authorisation defect**, found while writing specs for something else,
  **proven before being fixed**, and escalated from P1 only once evidence
  existed.
- **A test harness built from zero in both languages**, including a
  request-spec setup that exercises the real tenant middleware, and a
  `RequestStore` reset without which tenant state leaks between examples and the
  suite passes or fails on ordering.
- **A reversible migration whose reversibility is asserted by CI**, not merely
  claimed in a commit message.
- **Failure paths designed rather than discovered**: model timeout, empty
  vacancy, duplicate job, absent quotes, oversized text.
- **Five documented instances of AI output being wrong**, two of them caught only
  because the claim was checked against a running system.

What is *not* claimed: the architecture is unchanged, the AI interviewer is
untouched, and three constraint signals remain open by choice, each with a
written reason in `03-problem-and-gap.md` §6.
