# Audit Compliance & Brief Verification

**Brief:** Rakamin Fullstack Product Engineer — AI Interview Platform  
**Audit date:** 24 September 2026  
**Scope:** repository documents, `api/`, `web/`, local runtime and test commands.  
**Overall result:** core local implementation and available automated checks pass; the assignment is **not yet 100% submission-complete**. PR #133 is recorded from the project owner's confirmation; final visual evidence, hosted video, hiring-platform upload, and current CI/review/merge state remain unverified.

## Step-by-step verification

| Step | Status | Evidence and remaining gap |
|---|---|---|
| 1. Setup & Environment | **Pass locally** | Ruby 3.3.2, Rails 7.0.10; PostgreSQL 14 accepts connections; Redis returns `PONG`; Vite `:5173` and Rails health `:3001` return HTTP 200; development migrations are up. This is a local-time check, not production health evidence. |
| 2. Domain Immersion | **Documented** | [`docs/step-2-domain-immersion.md`](docs/step-2-domain-immersion.md) covers recruiter/assessor and candidate journeys, product evaluation criteria, evidence boundaries, assumptions and UU PDP considerations. Legal/controller decisions remain open by design. |
| 3. Problem Analysis | **Documented** | [`step-3-problem-analysis.md`](step-3-problem-analysis.md) records 0 P0, 8 P1, 15 P2 and 2 P3 findings, classifies missing specification vs defective implementation, states impact/root cause and flags constraint signals. Invite routing was an identified defect and has since been fixed in code. |
| 4. Revamp Strategy | **Documented** | [`step-4-revamp-strategy.md`](step-4-revamp-strategy.md) selects Option A (tenant boundary and evidence verification), includes acceptance criteria, edge cases and option trade-offs. |
| 5. Monozukuri Implementation | **Local implementation/tests pass; integration evidence partial** | Tenant membership auth and `X-Tenant-Scheme`, JWT request validation, REST/WebSocket authorization, `Portfolios::EvidenceValidator`, `not_assessed`, persisted fit-gap generation state, and API–UI `expected_level`/`is_override` contracts are present. RSpec and web contract suite pass; see test record below. No DB-backed two-tenant request/WebSocket integration suite, component/E2E suite, or live Gemini semantic verification is evidenced. |
| 6. Final Submission | **Draft exists; submission incomplete** | [`step-6-final-report-draft.md`](step-6-final-report-draft.md) has narrative, tests, seeded fault history, AI verification moment, PR #133 URL and 3–5 minute video outline. PR #133 is recorded per owner confirmation; CI/reviewer/merge status is not independently verified. The report is Markdown, not final PDF. Sanitized final UI screenshots, hosted video and hiring-platform upload remain outstanding. |

## Automated checks run

| Command/check | Result |
|---|---|
| `api/`: `bundle exec rspec` | **12 examples, 0 failures** |
| `web/`: `npm run test` | **4 passed, 0 failed**. Script invokes TypeScript contract compilation and Node's built-in test runner; it is not Vitest. |
| `web/`: `npm run build` | **Pass** — TypeScript and Vite production build completed. Vite emitted a dependency annotation warning, not a build failure. |
| Rails `zeitwerk:check` | **Pass** — “All is good”. |
| Development migration status | **Pass** — all migrations are up. |
| Health endpoints | **Pass** — frontend HTTP 200; `/api/v1/health` HTTP 200. PostgreSQL and Redis responded to local health probes. |
| Invite route | **Pass after fix** — generated URL uses configured frontend origin; Vite serves candidate path (HTTP 200), API host does not own that route (HTTP 404 by design). |
| `git diff --check` | **Pass** at audit check. |

These checks establish local correctness for the tested paths only. They do not establish production security, legal compliance, model quality/fairness, or database concurrency safety.

## Monozukuri proof

### Seeded Fault Test

On a separate local scratch branch `codex/seeded-fault-proof`, validator maximum rating was deliberately changed from 5 to 6 in commit `96b0315`. The targeted test caught the defect: **4 examples, 1 expected failure**, where rating 6 was accepted instead of `not_assessed`. Revert commit `3561c47` restored the 1–5 boundary; the same suite became **4 examples, 0 failures**. The scratch branch/worktree is local and was not pushed. Fixtures are synthetic.

### AI Verification Moment

An AI-assisted review missed the already documented candidate invite host mismatch: the generated `/interview/:token` link pointed to Rails API port 3001 while that route belongs to React/Vite. A supplied screenshot reproduced Rails' no-route error. Route checks confirmed Vite handles the candidate path and Rails does not; implementation was corrected to use `FRONTEND_BASE_URL`, with a local default and production fail-fast behavior. The validator's separate offline AI-output check accepts valid evidence from two distinct stored candidate turns and maps malformed rating/fabricated quote cases to `not_assessed`. This is not a live Gemini call or a claim of semantic/model quality verification.

## Brief requirements still outstanding

1. Verify PR #133's CI/reviewer/status with valid GitHub access; the URL itself is recorded from the project owner's confirmation, but `gh auth status` reported an invalid token during audit.
2. Produce sanitized final UI screenshots showing the revamped flow and required error/edge/responsive states. Current supplied screenshots are pre-fix reproductions and include local/synthetic identifiers; they are not final-state evidence.
3. Record and host the requested **3–5 minute walkthrough**; the written outline is ready, but no video URL exists yet.
4. Convert the final, evidence-complete report into the brief's single PDF and upload it to the hiring platform. No upload receipt or submission link is available.
5. For stronger implementation assurance, add/run PostgreSQL-backed request tests for two-tenant REST/WebSocket access and fit-gap locking/retries. Current tests are unit/service/contract level; web uses native Node tests, not Vitest. No line/branch coverage metric is configured.
6. Resolve the migration rollback constraint operationally: down migration intentionally refuses rollback after `not_assessed` data exists, because the old schema cannot represent it losslessly. Use restore/forward-fix for that state.
7. Keep controller/legal decisions explicit: candidate notice, purpose/legal basis, retention/deletion, rights/objection handling, DPIA where applicable, processor terms and international transfer/location of AI-provider data.

## Repository references

- [Step 2 — Domain Immersion](docs/step-2-domain-immersion.md)
- [Step 3 — Problem Analysis](step-3-problem-analysis.md)
- [Step 4 — Revamp Strategy](step-4-revamp-strategy.md)
- [Step 5 — Monozukuri Execution](step-5-monozukuri-execution.md)
- [Step 6 — Final Report Draft](step-6-final-report-draft.md)
