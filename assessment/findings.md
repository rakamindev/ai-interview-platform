# Problem & gap analysis

**Baseline:** `b836d02` · **Claimed depth:** balanced

## The core problem

This product's job is to produce a **defensible** rating of a human being. It
produced a **confident-looking** rating it could not defend, and then hid the
one signal that would have let a human catch it.

Three failures compounded, with a data-protection failure underneath:

1. **The system could not say "I don't know."** `portfolio_skills.ai_level` was
   `NOT NULL`, so the schema had no representation for a skill that was never
   probed. `skill_data['level'].to_i.clamp(1, 5)` turned a null into **L1 — the
   lowest possible rating** — on a skill nobody asked about, which the fit/gap
   engine then reported as a hard gap.
2. **The system destroyed the human correction.** Regeneration called
   `destroy_all`, which cascaded through `dependent: :destroy` on
   `assessor_override`. An automatic retry erased human judgement.
3. **The system hid its own uncertainty at the decision point.** The engine
   emitted `expected_level`/`confidence`; the table read
   `required_level`/`is_override`. The Required column was blank on every row,
   the override marker never appeared beneath a legend promising it, and
   confidence was never shown.
4. **The tenant boundary did not cover candidate evidence.** Any authenticated
   assessor could read, export and write to another tenant's candidate data.

The gap to an ideal condition is not a feature. It is that **an assessment
platform must be able to distinguish "we did not ask" from "they cannot do it",
and must show its work at the moment a human decides.**

## Severity table

`M` = missing specification (never defined) · `D` = defective implementation (defined but broken)

| # | Sev | Finding | Type | Impact on the real workflow | Fixed |
|---|-----|---------|------|------------------------------|-------|
| 1 | P0 | `nil.to_i.clamp(1,5)` → L1 on never-probed skills (`generator.rb:161`) | M+D | A candidate is documented as deficient at a skill never discussed | ✅ |
| 2 | P0 | Cross-tenant read/write of candidate evidence (`portfolios_controller.rb:82,104,130,156`, `portfolio_skills_controller.rb:51`) | D | Tenant A exports tenant B's candidate quotes and writes overrides on them | ✅ |
| 2b | P0 | `FitGapGeneratorWorker` has no request context, so `TenantScoped` degrades to `all` and nothing stops a portfolio and vacancy from different tenants being compared | D | Two tenants' candidate data joined into one report | ✅ |
| 3 | P0 | Regeneration destroys assessor overrides (`generator.rb:154` + `portfolio_skill.rb`) | M+D | Human judgement erased by an automatic retry (`retry: 3`) | ✅ |
| 4 | P0 | Fit/gap contract mismatch (`engine.rb:58` vs `ComparisonTable.tsx:50,56`) | D | Required column blank on every row; overrides invisible; verdict unsourceable | ✅ |
| 5 | P0 | `save_skills` partial writes, no transaction (`generator.rb:150-179`) | D | Half-written portfolio persisted and marked `failed` | ✅ |
| 6 | P1 | Confidence computed, never surfaced at the decision point | M | A low-confidence guess is indistinguishable from an evidenced finding | ✅ |
| 7 | P1 | `find_map` nil-id collision (`analyzer.rb:167`) | D | A null id in the model response updates an arbitrary custom skill | ❌ out of scope |
| 8 | P1 | Fit/gap report destroyed before the worker succeeds (`portfolio_skills_controller.rb:41`) | D | Worker failure = permanently lost report | ✅ |
| 9 | P1 | `FitGapReportPage` has no error state; polls forever | M+D | Dead worker = infinite spinner, no recovery path | ✅ |
| 10 | P1 | No unique constraint on `(portfolio_id, skill_label)` | M | A repeated model emission persists duplicate rows | ✅ |
| 11 | P2 | `Array(evidence)` on a Hash yields `[[k,v]]` pairs (`generator.rb:163`) | D | Key/value pairs rendered to assessors as candidate quotes | ✅ |
| 12 | P2 | Medium confidence labelled "confirmed"; raw `3` not `L3` (`FitGapReportPage.tsx:196`) | D | Overstates certainty to the decision-maker | ✅ |
| 13 | P2 | Culture card silently falls back to the overall fallback string | D | Arithmetic presented as analysis, with no failure signal | ✅ |
| 14 | P2 | `advance_stale_partials` auto-promotes at `probe_count >= 4` | M | Coverage inflated without model confirmation | ❌ out of scope |
| 15 | P2 | `EndHandler` fire-and-forget enqueue, no reconciliation | M | A Redis blip leaves the portfolio `pending` forever | ❌ out of scope |
| 16 | P2 | `ConfidenceIndicator` renders unknown confidence as a definite "LOW" | D | A claim about a rating that may not exist | ✅ |
| 17 | P3 | `getOverride` is a POST; `update_column` skips validations; `max-w-2xl` on a table page; README documents port 3000, API serves 3001 | D | Maintainability and layout | partial |

## Why the type system did not catch #4

`web/src/types/index.ts` **declared** `required_level` and `is_override`, so the
compiler was satisfied by fields the API had never sent. An axios response is
cast, not validated. The interface contained two further lies: `ai_level` typed
as `string` `"L3"` when the controller sends an integer (which is why the
defensive `parseLevel()` band-aid existed), and `skill_id` typed as `number`
against a `varchar(50)` column.

The root cause is not the mismatch. It is that **the type layer was decorative**,
and the symptom of a drift was a blank cell rather than an error. That is why
the fix is a Zod parse at the boundary, not a corrected interface.

## Constraint signal

Escalated on day one, as would be raised with a Technical Lead on a live project:

**No `GEMINI_API_KEY` was available.** Every AI-dependent path was unreachable.
The mitigation was `Gemini::StubClient`, injected through the `gemini_client:`
parameter every service already accepted.

The architectural signal underneath is the finding worth naming: **the codebase
had no seam for running without the vendor, which is also why it had no tests.**
The seam was designed and never used. Any team inheriting this would hit the
same wall on day one; activating it is the prerequisite for testing anything.

**Second constraint, disclosed plainly:** the backend specs in this submission
were written but not executed — the available environment had Ruby 3.0.2 against
the repo's 3.3.2, no bundler and no PostgreSQL. All Ruby parses; none is proven.
The frontend was executed: `tsc --noEmit` clean, 23 tests passing.
