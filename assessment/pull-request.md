# Pull request body

> Paste as the description of the umbrella PR against `rakamindev/ai-interview-platform`.
> Structure: **Option B** — umbrella PR stating the vision, with focused sub-PRs.
> The work has four natural seams (harness, backend, frontend, docs) and
> decomposing it for reviewers is itself part of what is being assessed.

---

## Evidence Integrity: teaching this product to say "I don't know"

### The problem

This product's job is to produce a **defensible** rating of a human being. It
produced a **confident-looking** rating it could not defend, and then hid the one
signal that would have let a human catch it.

`portfolio_skills.ai_level` was `NOT NULL`, so the schema had no way to represent
a skill that was never probed. In `Portfolios::Generator`:

```ruby
ai_level: skill_data['level'].to_i.clamp(1, 5)   # nil.to_i => 0 => clamp => 1
```

A missing level became **L1 — the lowest possible rating** — on a skill nobody
asked the candidate about. `FitGap::Engine` then reported that fabricated L1 as a
hard **gap** against the vacancy. A candidate was documented as deficient at
something that was never discussed.

Three things made it invisible:

- **Regeneration erased the human check.** `destroy_all` cascaded through
  `has_one :assessor_override, dependent: :destroy`, and the worker retries three times.
- **The decision surface hid its uncertainty.** The engine emitted
  `expected_level`/`confidence`; `ComparisonTable.tsx` read
  `required_level`/`is_override`. The **Required column was blank on every row**,
  the ✏ override marker never appeared beneath a legend promising it, and
  confidence was never displayed.
- **The tenant boundary did not cover candidate evidence.** `Portfolio.find` and
  `PortfolioSkill.joins(:portfolio).find` were unscoped, so any authenticated
  assessor could read, export and write to another tenant's candidate data.

### The change

| Area | Change |
|---|---|
| Schema | `assessment_state` enum (`assessed`/`insufficient_evidence`/`not_probed`), `ai_level` and `ai_confidence` nullable, DB check constraint keeping rating and state in agreement, unique index on `(portfolio_id, skill_label)` |
| `ResponseContract` | Validates instead of coercing. **Iterates the coverage map, not the model response** |
| `Generator` | Transactional upsert on natural key; overrides survive; advisory lock makes duplicate jobs a no-op |
| Tenancy | `SessionTenantScoped` scopes the portfolio tree through `sessions`; fails closed; refusals are 404 |
| `FitGap::Engine` | Emits the contract the client reads; unassessed is never a gap; additive strengths included; `narrative_status` explicit |
| Frontend | Zod parse at the boundary; `ComparisonTable` rebuilt; every page state; unassessed rendered honestly |
| Harness | RSpec from zero, `Gemini::StubClient` with 14 hostile modes, Vitest, GitHub Actions |

### The design decision to review first

`ResponseContract` **iterates the coverage map rather than the model's response.**
The coverage map is the authority on *whether* a skill was assessed; the model is
only the authority on *what the rating should be* if it was. That single inversion
resolves the fabricated-L1 bug, the hallucinated-skill bug and the
silently-dropped-skill bug together.

### Migration safety

Reversible, with explicit `up`/`down`. Existing rows backfill to `assessed` — the
only truthful option, since they were all written under the old always-rate
contract. The `down` path deletes unrated rows and announces the count: the old
schema cannot represent a skill without a level, and the alternative is
back-filling the exact fabricated number this change removes. CI asserts the
rollback runs clean.

### Verification

- 18 generator specs, 13 fit/gap specs, 14 tenant-isolation specs, 3 worker specs (48 total)
- 23 frontend tests; `tsc --noEmit` clean
- Every isolation example is **paired** with a positive case — without it,
  scoping everything to `none` would pass the file while breaking the product
- Seeded fault test: each P0 reintroduced on `scratch/seeded-fault`, caught,
  reverted, history visible
- `rails db:seed:demo` builds a session with a deliberately unprobed skill

### Deliberately out of scope

`find_map`'s nil-id collision and `advance_stale_partials`' auto-promotion are
both in the live-interview coverage path. Validating a change there needs a real
Gemini key and live session data; altering state-machine thresholds without
either is guessing at behaviour that decides what a candidate is asked. Listed
with reasons in `assessment/assumptions.md`.

### Known CI finding: GitGuardian "secret"

GitGuardian flags `.github/workflows/ci.yml` for a "Generic Password" — the
literal string `postgres` that was briefly used as `POSTGRES_PASSWORD` for the
ephemeral Postgres service container. It is not a credential: that container
exists only for the duration of a single CI job on an isolated runner, with no
external exposure, and is destroyed when the job ends. It was replaced with
`POSTGRES_HOST_AUTH_METHOD: trust` (no password at all) in a later commit.

The check still shows red because GitGuardian scans full PR commit history,
and the string remains present in the commit that first introduced it — a
later fix can't retroactively erase an earlier commit's diff without a history
rewrite. Given this branch includes a merge commit, rewriting history to
force the string out carries more risk (of tangling that history, or
confusing the PR's diff view after a force-push) than the finding itself
carries risk (a throwaway value with a ~30-second blast radius on a
disposable container). Left as-is and documented here rather than rewritten.

### Constraint signal

No `GEMINI_API_KEY` was available. Mitigated with `Gemini::StubClient`, injected
through the `gemini_client:` parameter every service already accepted. The
architectural finding underneath: **the codebase had no seam for running without
the vendor, which is also why it had no tests.** The seam was designed and never
used.

---

### Sub-PRs

1. `feat/evidence-integrity-harness` — RSpec, factories, stub client, demo seed, CI
2. `feat/evidence-integrity-backend` — migrations, contract, generator, tenancy, engine
3. `feat/evidence-integrity-frontend` — types, Zod, ComparisonTable, page states
4. `feat/evidence-integrity-docs` — findings, acceptance criteria, trade-offs, AI log
