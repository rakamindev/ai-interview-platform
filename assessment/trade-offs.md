# Option evaluation & trade-offs

Four decisions where a cheaper option existed and was rejected. Each is scored
on product impact vs cost, long-term maintainability, failure modes, and fit to
*this* codebase under *this* deadline.

---

## 1. Representing "not assessed"

| | **A — nullable level + state enum** ✅ | B — sentinel level 0 | C — separate `unassessed_skills` table |
|---|---|---|---|
| **Impact vs cost** | One migration; every consumer must handle null, which is the point | Cheapest — no consumer changes | Cleanest model; largest change |
| **Maintainability** | State is self-describing; DB check constraint keeps level and state in agreement | 0 means "unassessed" only by convention; a new reader will average it or render "L0" | Two tables to keep in sync; every read becomes a union |
| **Failure modes** | A missed null check throws loudly | Silent arithmetic corruption — the exact class of bug being fixed | Drift between tables; a skill in both or neither |
| **Contextual fit** | Forced the UI bug into the open: typing `ai_level` as `number \| null` made `tsc` reject `parseLevel()` in two components | Would have left the UI bug invisible | Too large for the deadline; no compensating benefit |

**Rejected B specifically because** it repeats the original sin. `.to_i.clamp(1,5)`
was itself a convention-based sentinel, and it silently became a rating. A
sentinel that survives a `nil` check is not a fix; it is the same bug relocated.

**Walk-back cost:** low. The `down` migration is written and deletes only
unrated rows, announcing the count.

---

## 2. Tenant scoping for the portfolio tree

| | **A — join through `sessions`** ✅ | B — denormalise `tenant_id` onto 4 tables | C — PostgreSQL row-level security |
|---|---|---|---|
| **Impact vs cost** | No migration; one concern; join on each lookup | Faster reads; 4 migrations + backfill | Strongest guarantee; enforced below the app |
| **Maintainability** | One authority for tenancy | Four copies to keep true | Policy lives outside the codebase reviewers read |
| **Failure modes** | A forgotten `for_current_tenant` — visible in review, and the scope fails closed | **A copied `tenant_id` drifts and the leak is silent** | Misconfigured `SET LOCAL` fails open; hard to test |
| **Contextual fit** | Matches how `TenantScoped` already works | Denormalisation without a measured read problem | Shares a database with `rakamin-api`; a global RLS policy is not ours to impose |

**Rejected B specifically because** silence is the worst property a
data-protection control can have. Denormalisation is the smaller diff and the
more familiar pattern, but a `tenant_id` that drifts through a backfill, a
restore, or one bad writer produces a leak nobody observes. Paying a join is
cheaper than paying that.

**Failure mode accepted:** the scope returning `none` without tenant context
could make isolation specs pass while the product is broken. Mitigated by
pairing every negative example with a positive one.

---

## 3. Preventing contract drift between services

| | **A — Zod parse at the boundary** ✅ | B — generated types from OpenAPI | C — Rails serializer + contract test |
|---|---|---|---|
| **Impact vs cost** | Zod is already a dependency; ~80 lines | Types can never drift; needs a spec, generator and CI step | No client dependency; one test per endpoint |
| **Maintainability** | Schema and type in one place | Strongest long-term; real infrastructure to own | Contract asserted in one repo, consumed in another — drifts quietly |
| **Failure modes** | Runtime throw at the boundary, naming the field | Stale spec silently reintroduces the bug | Test passes while the client reads a different key |
| **Contextual fit** | Converts a blank cell into a loud failure today | Correct destination, wrong week | Would not have caught this bug: the API was self-consistent, the client disagreed |

**The reasoning that matters:** the defect was not the mismatch, it was that its
symptom was an empty cell. A blank column is indistinguishable from "no data",
so it survived to production. Any fix that leaves failure silent is not a fix.
**B is the right eventual answer** and is the recommended follow-up; A buys the
property that matters now, at a fraction of the cost.

---

## 4. Preserving assessor overrides across regeneration

| | **A — upsert on natural key** ✅ | B — `dependent: :nullify` | C — copy overrides out and replay |
|---|---|---|---|
| **Impact vs cost** | Rows keep the id the override points at | One-word change | Explicit, easy to read |
| **Maintainability** | Natural key must stay stable — enforced by the unique index | Orphaned overrides accumulate with no owner | Two write paths to keep in agreement |
| **Failure modes** | A renamed skill looks new; the old row is superseded, not deleted | **An override pointing at nothing is worse than one deleted — it looks intact** | Replay fails silently mid-way |
| **Contextual fit** | Also fixes the partial-write and duplicate-job defects in the same transaction | Fixes nothing else | Reimplements what the database already does |

**B was the first suggestion an AI tool produced**, and it is superficially
attractive. It is worse than the bug: a nullified override still appears in
`assessor_overrides`, so an audit would report human review that no longer
attaches to any rating. Recorded in the AI verification log.

**Design decision inside A:** when the model stops returning a skill a human has
rated, the row is marked `superseded_at` and kept. An assessor's judgement
outranks a model's silence.

---

## Summary

Three of the four decisions rejected the cheaper option for the same reason:
**it would have failed silently.** A sentinel that reads as a rating, a
denormalised column that drifts, a blank column that reads as no data, an
orphaned override that reads as review. In an assessment product the cost of a
silent failure is not downtime — it is a wrong conclusion about a person,
delivered with the same confidence as a right one.
