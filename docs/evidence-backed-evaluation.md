# Evidence-Backed Evaluation

Engineering documentation for the flagship change: turning AI interview results from
opaque scores into an evidence-backed, decision-support system.

## Problem

The interview result is a number. Assessors and hiring managers cannot tell:

- which competencies were actually assessed (coverage),
- how confident the model is in each rating,
- what evidence — and counter-evidence — supports a rating,
- when a human should step in instead of trusting the AI.

Two additional issues were found and fixed in this change:

1. **P0 data-isolation gap.** Portfolio reads used unscoped `Portfolio.find(id)`. An
   assessor who guessed another tenant's portfolio ID could read that candidate's data —
   a violation of multi-tenant integrity and Indonesia's UU PDP data-minimization.
2. **No failure policy for the AI boundary.** A model timeout or malformed response had no
   defined behavior, so a bad AI response could silently become a confident score.

## Acceptance criteria

| Criterion | How verified |
|---|---|
| Coverage bar reflects assessed vs total skills | `web` Vitest |
| Skill cards show status + supporting + counter-evidence | `web` Vitest |
| `needs_review` surfaces human-readable reasons | `Evaluations::Summary` spec |
| A missing competency never becomes an artificial zero | `Evaluations::Summary` spec |
| AI timeout / malformed output → structured failure, no silent zero | `InterviewEvaluatorService` spec |
| PII redacted before reaching the model | `Ai::PiiScrubber` spec |
| Cross-tenant portfolio read is denied | `tenant_isolation_spec` (request spec) |
| Fit/gap cache invalidated by newer overrides; export/regenerate validation | `portfolios_controller_spec` (request spec) |
| Migration reversible & safe against existing rows | reversible `change` + `counter_evidence` default `[]` |
| Candidate outcome feedback is token-gated, tenant-safe, and never leaks raw levels/overrides | `feedback_spec` + `wow_endpoints_spec` |
| Integrity signals persisted and surfaced to assessors | `wow_endpoints_spec` (integrity) + `TrustContextPanel` |
| Fair comparison normalizes candidates onto one rubric, tenant-isolated | `wow_endpoints_spec` (comparison) |
| Candidate consent confirmation modal gates interview start | `web` Vitest (`ConsentModal`) |
| Fit/Gap comparison breakdown table renders seamlessly with Sidekiq background execution | `web` Vitest (`ComparisonTable`) + Docker Sidekiq worker |
| Frontend suite green, typecheck + build clean | Vitest 27/27, `tsc --noEmit`, `vite build` |
| Backend suite green | RSpec 53/53 (via Docker) |

## Design principles

- **Not demonstrated ≠ poor.** A competency with no evidence is never scored as zero; it is
  flagged for human review (`not_assessed` + `needs_review`).
- **Score ≠ certainty.** Low confidence / thin evidence is surfaced separately as `partial`.
- **Decision-safety layer.** `needs_review` vs `ready_for_review` separates "AI suggests"
  from "AI is sure".
- **Tenant isolation.** Every portfolio read resolves through the tenant-scoped session
  (`sessions.tenant_id`), including `export`, `fitgap`, and `regenerate_fitgap`.
- **UU PDP as a design constraint.** PII is scrubbed at the AI boundary, blind mode
  anonymizes the candidate for the assessor, and clicking "Start Interview" triggers an
  explicit confirmation dialog (**Consent Modal**) informing candidates of voice processing
  and their statutory data rights before capturing media.

## Trade-offs considered (Option A vs B)

**Option A — Deterministic summary + strict AI boundary (chosen).**
`Evaluations::Summary` is pure business logic (no DB writes, no AI), so it is trivially
testable and deterministic. The AI boundary (`InterviewEvaluatorService`) has an explicit
failure policy (timeout / failure / malformed) and scrubs PII before every send. Cost:
small amount of new service code. Forecloses: nothing — the summary is derived, not stored.

**Option B — Let the model emit its own confidence/status.**
Cheaper to write, but the output is non-deterministic, untestable, and puts correctness in
the hands of the model with no human-readable audit trail. Rejected: contradicts the
"score ≠ certainty" thesis and makes the test suite flaky by design.

## Edge cases handled

- Portfolio not yet generated / generating → API returns `202 {status: "generating"}`.
- Portfolio generation failed → API returns the portfolio plus `generation_error`.
- Skill with no evidence → `not_assessed`, listed in `review_reasons`.
- Skill with evidence but low confidence → `partial`, listed in `review_reasons`.
- Empty portfolio → `needs_review` with "No skills were assessed".
- AI timeout / HTTP error / malformed JSON → typed failures (`EvaluationTimeoutError`,
  `EvaluationFailureError`, `MalformedEvaluationError`); transient failures retried.
- Fit/gap cache: an existing report is reused only when no assessor override was applied
  after it was generated (overrides feed into the fit/gap output).
- Very long text: `EvidenceQuote` serialization is truncation-free; UI wraps long quotes.

## Verification evidence

```bash
# Backend (Docker harness; no native Ruby needed)
docker compose -f docker-compose.test.yml run --rm api bundle exec rails db:prepare
docker compose -f docker-compose.test.yml run --rm api bundle exec rspec
# → 53 examples, 0 failures

# Frontend
cd web
npm run typecheck   # clean
npm test            # 24 tests, 0 failures
npm run build       # vite build clean (output → web/dist/, gitignored)
```

- **Seeded fault test (recorded):** on scratch branch `proof-seeded-fault` the
  low-confidence guard in `Summary#status_for` was dropped (`partial` → always
  `assessed`). RSpec went **red** — `2 failures`:

  ```text
  1) Evaluations::Summary#call when evidence is present but confidence is low
     marks the skill partial and requests human review
     expected: "needs_review"
          got: "ready_for_review"
  2) Evaluations::Summary#status_for maps assessed / partial / not_assessed
     expected: "partial"  got: "assessed"
  ```

  Commit `1ffeec4` (SEEDED FAULT) → `git revert` → RSpec **green 22/22**
  (commit `fc3b98f`). Scratch branch deleted; history recorded in the report.
  (Full suite has since grown to **53/53** with controller + wow request specs.)
- **AI verification moment:** documented in the external report — an AI-generated snippet
  was corrected after verification (see report §AI verification).

## Beyond the flagship — candidate & assessor "wow" features

All five Tier-1 ideas are shipped as part of this PR (see `PROJECT-ROADMAP.md` §Beyond Expectations):

- **W1 Candidate Outcome Feedback** — `/feedback/:token` (public, token-gated, tenant-safe).
  `Evaluations::Feedback` composes a warm, non-scoring summary (strengths, growth areas,
  coverage). Deliberately never exposes raw 1–5 levels, confidence, or assessor overrides.
  Backed by `feedback_spec` (privacy assertions) + `wow_endpoints_spec`.
- **W2 Session Trust & Context** — `sessions.integrity_metadata` (JSONB, reversible migration)
  captured best-effort from the candidate browser (device state, connection health, reconnect
  events via `POST /sessions/:token/integrity`). Shown to assessors as a transparent
  `TrustContextPanel` on the portfolio page.
- **W4 Fair Comparison** — `GET /assessments/:id/comparison` normalizes completed candidates
  onto one rubric (coverage, avg level, status, overrides) and ranks them. Tenant-isolated via
  the scoped assessment lookup; `ComparisonPage` renders the table.
- **W5 Interview Prep Hub** — calm pre-interview panel (what to expect, skill areas from
  `candidate_info`, non-scored practice questions) that lowers candidate anxiety before the live
  interview.
- **#13 Monozukuri polish** — reusable `EmptyState` component with instructive copy applied to
  assessments, vacancies, and transcript pages; consistent loading/error/empty states throughout.

## CI

`.github/workflows/ci.yml` runs on PRs and pushes to `main`:

- **backend:** Postgres 16 + Redis services, `db:prepare`, RSpec, RuboCop.
- **frontend:** Node 20, `npm ci`, typecheck, Vitest, production build.

The Docker test harness (`api/Dockerfile.test` + `docker-compose.test.yml`) mirrors the CI
database config so the suite can be proven locally on any machine.