# Discovery and execution plan

Baseline: upstream main `b836d02f45c6300b238b98ad50e66ead706723b6`. Started 25 October 2026 (WIB). Candidate reports four days available; dashboard deadline takes precedence over the stale brief.

## Context and boundaries

Recruiters and assessors need a defensible comparison of interview evidence against role requirements. Candidates bear the cost of an unsupported negative judgment. The selected workflow is portfolio -> vacancy comparison -> human review -> export. A skill not assessed must not be described as a demonstrated gap. No candidate ranking, automatic rejection, or inferred culture fit is necessary for this comparison.

Repository setup and code inspection precede implementation. Browser exploration and API/database observations will be recorded separately. No interviews or business impact measurements have been conducted; user needs here are hypotheses inferred from the brief and product specification.

## Initial findings (static inspection; runtime reproduction pending)

Severity definitions: P0 immediate broad exposure or unusable system; P1 incorrect assessment or unauthorized disclosure; P2 recoverable workflow or reliability problem; P3 minor clarity/polish issue.

| ID | Priority | Finding and workflow impact | Classification | Evidence |
| --- | --- | --- | --- | --- |
| F1 | P1 | API emits expected_level but comparison UI reads required_level. Recruiter cannot see the benchmark behind a gap. | Defect | FitGap::Engine and ComparisonTable.tsx |
| F2 | P1 | Comparison omits human override provenance. Recruiter cannot distinguish AI rating from assessor revision. | Defect | effective_portfolio_skills vs emitted comparison |
| F3 | P1 | Portfolio and skill endpoints query children without tenant ownership; authenticated assessor may reach another tenant's data by ID. | Defect | PortfoliosController and PortfolioSkillsController |
| F4 | P2 | Polling treats missing reports as new work on each cycle; duplicate jobs have no durable pending/failed state. Recruiter can wait indefinitely. | Defect / missing lifecycle specification | FitGapReportPage and FitGapGeneratorWorker |
| F5 | P1 | Portfolio generation converts missing or malformed ratings to L1 with to_i.clamp and deletes previous skills before validation. Candidates may receive unsupported ratings and human review may be lost. | Defect | Portfolios::Generator#save_skills |
| F6 | P2 | Narrative asks for culture fit and hiring recommendation using skill levels alone. Confidence limits and unassessed skills can be obscured. | Missing evidence policy | FitGap::Engine#build_narrative_prompt |
| F7 | P3 | Not-assessed count is absent from comparison summary; loading, error, and long text states lack a coherent review path. | Defect | ComparisonTable and FitGapReportPage |

## Constraint signal

An actual Gemini key, microphone interview, and model availability are external dependencies. The chosen comparison must work deterministically without an AI provider; no simulated model output will be described as a live AI validation. Existing multi-tenant auth and shared database assumptions require explicit scope and negative authorization tests. Ruby/Redis are missing on Windows; use isolated Docker services through WSL rather than altering the user's running PostgreSQL instance.

## Options

| Option | Value / cost | Maintenance and failure modes | Decision |
| --- | --- | --- | --- |
| A. Frontend-only field repair | Quick benchmark visibility; lowest cost | Leaves tenant access, duplicate generation, and stale comparison risks | Rejected: insufficient integrity |
| B. Deterministic comparison with persisted lifecycle, provenance, authorization, and complete review UI | One coherent fullstack change; moderate cost | Keeps current Rails/Sidekiq/React stack; DB locking and explicit failure/retry; reversible migration | Selected |
| C. Replace assessment engine and interview flow | Potential broad benefits; high cost | Larger migration and real-time/model surface cannot be defended in four days | Deferred |

## Acceptance criteria written before feature implementation

1. Compare every vacancy requirement in stable order; display expected and effective levels with signed delta.
2. Match by canonical skill ID when supplied; only use normalized label fallback for custom skills. Never silently merge distinct canonical skills with the same label.
3. Missing, invalid, or absent ratings produce not_assessed and no numeric delta, never an invented L1. Count missing evidence separately from gaps.
4. Human revisions show original AI level, effective level, and source. Changes invalidate prior comparisons without deleting the last successful report.
5. Report endpoints, overrides, exports, and background execution enforce portfolio/session and vacancy tenant ownership. Unauthenticated, wrong-role, unknown-tenant, and cross-tenant access are rejected without data disclosure.
6. A durable queued/generating/complete/failed lifecycle supports duplicate requests, job redelivery, bounded waits, and explicit retry. Failed refresh preserves last successful content and never labels it current.
7. Comparisons remain usable without Gemini. Skill levels alone must not generate culture-fit claims or autonomous hiring recommendations.
8. Database changes are additive, reversible, and safe for existing reports. Test migration up/down/up with existing rows.
9. Interface includes loading, no evidence, no requirements, failed generation, refresh, export failure, long labels, narrow screens, and keyboard/focus states.
10. Tests prove actual regressions: backend service/request/job and frontend rendering/lifecycle tests; deliberately seed and revert a fault with visible history.

## Design direction

Reading this as an assessor review workspace for recruiters, extending the existing Rakamin light teal system. ENERGY 1 / RHYTHM 2 / MOTION 1. Existing typography and navigation are preserved; layout prioritizes evidence completeness, required versus observed level, and review provenance. Teal marks primary actions; amber identifies incomplete evidence; text accompanies every status. Tables on desktop become readable stacked rows on mobile. Motion only communicates busy state. No invented logos, testimonials, statistics, or decorative assets.

## Deliverables

One focused upstream PR; reproducible local setup; automated tests and CI; report with discovery, domain sources, decisions, screenshots, seeded-fault and AI-verification proof; 3-5 minute demo and live-defense notes. Written deliverables live in assessment/ per upstream README.
