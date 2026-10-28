# Fullstack case study: fit/gap report reliability

## 1. Setup and exploration

The repository is a Rails API (`api/`) and a React/TypeScript client (`web/`). I traced the assessor workflow from the portfolio page to the fit/gap POST, Sidekiq worker, report JSON, comparison table, and export endpoints. The report is a high-impact hiring aid: an incorrect or missing comparison can bias an assessor's view of a candidate before a human conversation.

The web app's production build is available locally. The API requires Ruby 3.3.2, PostgreSQL, Redis, and Gemini configuration; Ruby and Bundler are not installed in this worktree, so I could not run the Rails app or RSpec. The initial repository had no RSpec examples.

## 2. Domain context and UU PDP

Hiring assessments affect candidates who may have little choice about how they are evaluated. A fit/gap view should make the source of each rating visible, distinguish lack of evidence from a low rating, and support—not automate—a hiring decision. The model prompt prohibits hiring recommendations and unsupported culture-fit claims; the screen repeats that this output is only for human review.

Under Indonesia's UU PDP, candidate assessment results should be treated as personal data even when direct identifiers are omitted. The report prompt uses role requirements and skill ratings, not candidate names or transcript text; the report path also scopes portfolio access to the request tenant. This is data minimization, not a compliance determination. The controller/processor basis, candidate notice, retention/deletion policy, and Gemini data-processing terms still require product and legal confirmation.

## 3. Gap analysis

| Priority | Finding type | Finding | Candidate / assessor impact |
|---|---|---|---|
| P0 | Defect | Report and assessor-override lookups accepted globally addressable portfolio IDs instead of enforcing the current tenant. | A valid assessor could reach or change another tenant's candidate evaluation. The report, export, and override paths now scope through the session tenant; the worker independently rejects cross-tenant IDs. |
| P1 | Defect | The API returned `expected_level`, while the UI rendered `required_level`; it also rendered an override marker the API never supplied. | Assessors could see a missing required rating and fail to distinguish human overrides. The API/UI contract is now aligned and override state is explicit. |
| P1 | Missing lifecycle behavior | Generation had no persisted lifecycle state. A missing report produced a blank view; repeated polling could enqueue duplicate jobs; a lost job could leave the page spinning indefinitely. | Assessors could not tell whether evidence was incomplete, delayed, or failed, and repeated requests could burden the model service. Reports now persist pending/generating/complete/failed states, workers claim pending rows under a lock, and the UI has a bounded wait and retry/error states. |
| P1 | Defect | Gemini errors used a generic count summary with no explanation of unassessed skills or hiring limits. | A candidate with missing evidence could be over-interpreted. The fallback now calls out unassessed requirements and says the comparison is not a hiring recommendation; logs omit provider error text. |
| P2 | Defect | Not-assessed skills were visually reduced to a dash, confidence was hidden, empty requirement sets had no explanation, and the overall narrative was hidden whenever a culture narrative existed. | Assessors could mistake missing evidence for a low score or miss relevant context. The screen now labels these states, displays confidence and both narratives, and handles empty/long content. |
| P2 | Missing behavior | A vacancy with zero configured skills is allowed by the existing API, but the report had no empty-state explanation. | The report could appear broken or imply an empty assessment was complete; the screen now states that no requirements are configured. |
| P3 | Defect | The screen did not show when the comparison was last completed. | Assessors could not judge how current a cached comparison was; the report now shows its last-completed timestamp. |

### Constraints and remaining product questions

- The existing schema does not record candidate consent, retention, or model-processing basis. These are launch blockers for a real deployment, not assumptions this code change can settle.
- Vacancy edits do not currently invalidate already completed reports. A report can therefore become stale if a role is changed after comparison; this should be addressed before treating reports as durable hiring records.
- The current feature does not show quote-level evidence alongside every comparison. The portfolio screen has that evidence; surfacing it in this report is a separate product decision.

## 4. Revamp strategy and acceptance criteria

| Option | Product impact and cost | Maintainability / reversibility | Failure modes and contextual fit |
|---|---|---|---|
| UI-only contract mapping | Low cost; fixes visible field mismatches only. | Simple, but duplicates assumptions in the UI and leaves backend behavior unchanged. | Does not address queue failures, duplicate jobs, or tenant scope; insufficient for a high-impact hiring view. |
| Persist report lifecycle and repair the full seam (**selected**) | Medium cost; improves accuracy, status visibility, retries, and human review. | Shared queue service plus one reversible migration; existing reports default to complete. | Worker claim locks prevent duplicate processing, stale jobs can be explicitly retried, and report data is updated atomically; best fit for the asynchronous model call. |
| Synchronous model generation in the request | Low initial code cost, but poor assessor experience when the model is slow. | Less state to maintain, but couples request availability to provider behavior. | HTTP timeouts can lose work and block the workflow; poor fit for a 30-second external call and its retries. |

Acceptance criteria for the selected slice:

- A portfolio and vacancy must belong to the authenticated tenant; missing resources return not-found, and a mismatched job cannot generate a report.
- A report can be requested only for a complete portfolio. The first request persists a pending record before queueing. Repeated requests for pending/generating work do not enqueue another job; an explicit retry can requeue pending or stale work, and the worker lock still allows only one job to claim it.
- A queued job claims a report once. Ordinary failures return the matching attempt to pending for Sidekiq retry; redelivered jobs that find that same attempt active retry without clearing its lease; exhausted retries mark only that attempt failed. Queueing failure is surfaced and does not leave a report stuck pending.
- Re-generation preserves the previous completed comparison until replacement succeeds. Never-completed placeholders are excluded from exports; the last completed snapshot remains exportable during regeneration.
- An assessor override supersedes an in-flight report; a per-attempt token prevents older workers, queue failures, and exhausted retries from changing a newer attempt. The client also surfaces retry after five minutes instead of polling forever.
- The comparison uses assessor override level when present; otherwise it uses the AI rating. Missing candidate evidence is `not_assessed`, with no numeric delta or confidence.
- Duplicate skill labels remain separate vacancy requirements; an empty vacancy does not trigger an unnecessary model call and is explicitly reported as having no comparison.
- Gemini timeout, malformed JSON, or empty narrative text must not erase the deterministic skill comparison. The fallback states that unassessed requirements remain and the output is not itself a hiring recommendation.
- The screen has loading, empty, pending, failure, retry, and long-text states; it remains usable on narrow screens and exposes errors/statuses to assistive technology.
- The screen shows the timestamp of the last successful comparison, including while a newer report is pending.
- No candidate names, transcript text, provider response bodies, or provider error messages are added to application logs or source control.

## 5. Implementation and evidence

### Changes

- Added report lifecycle, worker-lease, and per-attempt token columns in one reversible migration, defaulting existing rows to `complete`; created `FitGap::ReportQueue` to serialize report creation per portfolio and avoid duplicate enqueueing for pending work.
- Updated the Sidekiq worker to claim pending reports under a row lock, verify tenant consistency, use a per-attempt token to isolate retries and superseded jobs, retry duplicate deliveries that collide with an active attempt, and mark only the matching exhausted attempt failed.
- Kept the last completed report while regenerating and excluded never-completed placeholder reports from PDF/JSON exports.
- Aligned comparison JSON and TypeScript types (`expected_level`, nullable candidate level/delta, confidence, override marker). Rendered not-assessed and empty states explicitly.
- Added visible portfolio/report loading and failure states, bounded polling, retry actions, narrative fallback, responsive content handling, and separate culture/overall narrative sections.
- Added RSpec examples for comparison behavior, missing ratings, model timeout/malformed output, duplicate skill requirements, empty vacancies, duplicate queue requests, superseded attempts, tenant mismatch, queue failure, and redelivered jobs during active generation.

### Validation

- `npm run build` — **passed** after installing the existing web dependencies. The first available type-check found a union-narrowing error in the new loading state; I added an explicit type guard and the production build then passed.
- `git diff --check` — **passed**.
- `bundle exec rspec spec/services/fit_gap` — **not run**: `bundle` and `ruby` are not installed in this worktree. The RSpec examples are present but not verified at runtime.
- Baseline red/green proof — **not available**: the repository had no RSpec examples, and the Rails toolchain is unavailable, so I did not claim a passing backend test or a recorded pre-fix failure.
- Seeded fault test on a scratch branch with visible revert history — **not performed**. The timeout/malformed-response failure paths are covered by new specs, but those specs could not be executed here.
- API integration, migration execution, browser screenshots, demo video, open PR, and final hiring-portal PDF — **not produced**. The API database/Redis/Gemini setup and external submission destinations are not available in this worktree.

### AI-generated code verification risk

The highest-risk generated change is the asynchronous report lifecycle: competing requests and retries could leave a row stuck or allow duplicate model calls. I added a database row lock for report creation and worker claims, a per-attempt token for conditional state transitions and stale-job isolation, queue-failure handling, and focused queue/timeout specs. The frontend build verifies its types and bundle, but the backend race behavior still needs execution against PostgreSQL/Sidekiq before release.
