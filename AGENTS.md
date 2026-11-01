# AGENTS.md

## Purpose and source of truth

This repository is a two-service AI interview and skills-assessment product. Work as a **product engineer**: understand the affected user and the intended behavior before changing code. Favor one complete, high-impact full-stack improvement over a broad, shallow rewrite.

Read, in order:
1. This file for day-to-day repository operation.
2. [Product principles](PRODUCT_PRINCIPLES.md) for interview, coverage, evidence, and candidate-impact invariants.
3. The [GitHub Wiki](https://github.com/rakamindev/ai-interview-platform/wiki), particularly [PRD 01 — First Principles: AI Interview Behavior](https://github.com/rakamindev/ai-interview-platform/wiki/PRD-01-%E2%80%94-First-Principles:-AI-Interview-Behavior) and [PRD 02 — Real Simulation: End-to-End Interview](https://github.com/rakamindev/ai-interview-platform/wiki/PRD-02-%E2%80%94-Real-Simulation:-End%E2%80%90to%E2%80%90End-Interview).

The PRDs specify intended behavior; the running application and code show actual behavior. Distinguish a **defective implementation** from a **missing specification**. Document reasonable assumptions instead of inventing requirements. Do not claim that existing code, an AI output, or a passing test proves product correctness without verification.

## Repository guidelines: structure and ownership

- `api/`: Ruby **3.3.2** / Rails backend. Domain code is in `api/app/`, database changes and development seeds in `api/db/`, configuration in `api/config/`.
- `web/`: React 18, TypeScript, Vite, Tailwind, Radix UI. Put route screens in `web/src/pages/`, reusable UI in `web/src/components/`, React hooks in `web/src/hooks/`, API clients in `web/src/services/`, state in `web/src/stores/`, and shared types/utilities in `web/src/types/` and `web/src/utils/`.
- `docker-compose.yml`: standard environment for the API, web app, Sidekiq, PostgreSQL, and Redis. Run development and validation commands through these services.

### Key backend code paths

| Concern | Starting point |
| --- | --- |
| Assessment system prompt | `api/app/services/assessments/system_prompt_compiler.rb` |
| Session lifecycle | `api/app/services/sessions/start_handler.rb`, `end_handler.rb` |
| Coverage analysis/state | `api/app/services/coverage/analyzer.rb`, `map_injector.rb`, `api/app/models/coverage_map.rb` |
| Async coverage updates | `api/app/workers/coverage_analyzer_worker.rb` |
| Live audio, transcripts, reconnection | `api/app/channels/audio_websocket_middleware.rb`, `api/app/clients/gemini/live_client.rb` |
| Portfolio generation | `api/app/services/portfolios/generator.rb`, `api/app/workers/portfolio_generator_worker.rb` |
| Fit/gap | `api/app/services/fit_gap/engine.rb` |
| Tenant resolution | `api/app/middlewares/tenant_resolver_middleware.rb` |
| REST endpoints | `api/config/routes.rb`, `api/app/controllers/api/v1/` |
| Schema and sample data | `api/db/`, particularly `api/db/seeds.rb` |

### Key frontend code paths

| Concern | Starting point |
| --- | --- |
| Routes | `web/src/App.tsx` |
| Candidate interview | `web/src/pages/interview/InterviewPage.tsx` |
| Audio socket | `web/src/hooks/useAudioWebSocket.ts` |
| Assessor live monitor | `web/src/pages/monitor/LiveMonitorPage.tsx` |
| Assessment result | `web/src/pages/portfolio/PortfolioPage.tsx` |
| Fit/gap report | `web/src/pages/fitgap/FitGapReportPage.tsx` |
| Portfolio API calls | `web/src/services/portfolios.ts` |
| Audio processing | `web/public/audio-worklet-processor.js` |

Paths describe the inspected upstream repository. Check the current branch before editing; filenames may evolve.

## Build, test, and development commands

### Local prerequisites and configuration

- Ruby version: `cat api/.ruby-version` (the inspected branch specifies `3.3.2`).
- PostgreSQL and Redis must be available. The database also contains shared Rakamin organization records in the `public` schema; the interview tables use `ai_interview`.
- Backend: `cd api && cp config/application.yml.sample config/application.yml`, then configure local database access, `SECRET_KEY_BASE`, Gemini model/key settings, CORS, Redis, and URLs. Do not copy sample API keys literally.
- Frontend: `cd web && cp .env.example .env`. Set `VITE_API_BASE_URL=http://localhost:3001/api/v1` and `VITE_WS_BASE_URL=ws://localhost:3001` (the inspected sample file still uses port 3000). Supply only development credentials and local tenant context.
- The seed file sets up a synthetic `test-corp` organization and documents how to mint a **development-only** JWT through the Rails console. Never commit or paste JWTs into code, fixtures, screenshots, or reports.
- Some README paths and model-setting names differ across files; verify against the checked-out configuration and current Gemini API before running live calls.

### Run the app

Use Docker Compose as the standard development and validation environment. Start the application with Docker before running the frontend, backend, database, worker, lint, build, or test commands. Do not run `npm`, `bundle`, `rails`, RSpec, or RuboCop directly on the host for validation.

```bash
# Start API, frontend, PostgreSQL, Redis, and Sidekiq
docker compose up --build
```

The API is available at `http://localhost:3001` and the frontend at `http://localhost:5173`.

### Validation

```bash
# Prepare the isolated Rails test database, then run backend tests and lint
docker compose run --rm -e RAILS_ENV=test api bundle exec rails db:prepare
docker compose run --rm -e RAILS_ENV=test api bundle exec rspec
docker compose run --rm -e RAILS_ENV=test api bundle exec rspec spec/path/to/example_spec.rb
docker compose run --rm --no-deps api bundle exec rubocop

# Run frontend lint, formatting check, Vitest, TypeScript, and production build
docker compose run --rm --no-deps web npm run check

# Run focused frontend tests when needed
docker compose run --rm --no-deps web npm run test -- src/path/to/example.test.tsx
docker compose run --rm --no-deps web npm run test:coverage
```

RSpec is configured under `api/spec/`. Name specs `*_spec.rb` and place them by responsibility, such as `spec/models/`, `spec/services/`, or `spec/requests/`. Vitest and React Testing Library are configured under `web/src/`; name frontend tests `*.test.ts` or `*.test.tsx`. These initial suites provide smoke coverage, not proof of complete product correctness. Manually verify microphone, AudioWorklet, WebSocket, and live AI flows through the Docker-hosted app with valid local services and credentials.

### Token-efficient validation output

- Capture complete command output in a temporary log, but print only lines matching `error`, `warning`, `failed`, `failure`, or `offense` with `rg -i` (use `grep -Ei` only if `rg` is unavailable).
- Preserve and report the original command exit code; filtered output must never hide a failure.
- When no matching lines exist, report only a concise pass summary with relevant test counts.
- Do not print routine dependency installation, compilation, image-build, or successful test progress.

## Coding style and naming

- Use **two-space indentation** and match nearby semicolon, quote, import, and formatting conventions.
- Ruby classes/modules: `PascalCase`; methods, variables, and database fields: `snake_case`.
- React pages/components: `PascalCase.tsx`; hooks: `use*`; services/utilities: `camelCase` where existing conventions agree.
- Reuse existing frontend components and design tokens. Avoid unrelated dependency upgrades, mass formatting, and framework changes.
- Run `docker compose exec api bundle exec rubocop` for Ruby edits; report any baseline violations rather than silently rewriting unrelated code.
- Never commit `.env`, `api/config/application.yml`, JWTs, API keys, credentials, or real candidate data.
- When conventions conflict, follow this priority: repository configuration, neighboring code, this guide, then framework defaults.

## Engineering principles

- **KISS:** Keep code simple, readable, and easy to debug. Prefer straightforward control flow and familiar patterns over clever abstractions.
- **YAGNI:** Do not build speculative features, extension points, configuration, or abstractions before a current product requirement needs them.
- **DRY:** Reuse shared behavior when duplication is meaningful and stable, but do not force unrelated concepts into one abstraction merely to remove a few repeated lines.
- Choose the smallest change that solves the actual product problem. Avoid premature optimization, unnecessary dependencies, broad refactors, and architecture changes without measurable benefit.
- Make behavior explicit and local where possible; favor clear names, small functions, and simple data flow over hidden magic.

## Code consistency

- Inspect related and neighboring files before writing code. Match their architecture, naming, formatting, error handling, and data-flow patterns.
- Reuse existing components, services, types, helpers, and design tokens before creating new ones.
- Keep changes minimal and scoped to the requested behavior. Do not include unrelated refactors or formatting.
- Prefer KISS and YAGNI. Apply DRY only when duplicated behavior is stable and genuinely shared.
- Preserve existing API contracts, database conventions, tenant isolation, and backward compatibility unless explicitly asked to change them.
- Do not add a dependency when the existing stack can solve the problem clearly.
- Avoid dead code, debug logs, commented-out implementations, temporary files, and unexplained TODOs.
- Add or update tests for changed behavior. Bug fixes should include a regression test where practical.
- Run all applicable linting, tests, type-checking, and builds through Docker Compose.
- Review the final diff before completion. Report changed files, validation results, assumptions, and anything left unverified.

## Essential product invariants

Read `PRODUCT_PRINCIPLES.md` before modifying interview or assessment behavior. In brief:

1. The AI is a **conversational interviewer**, not a fixed question list. It probes the candidate's actual answer and does not supply answers for them.
2. Configured skill coverage follows `not_yet → initiated → partial → covered`. **Never advance beyond `initiated` without at least two meaningful probes/exchanges**, even after a strong first answer; `covered` additionally requires defensible behavioral evidence.
3. Off-agenda skills may be discovered and explored briefly; return to configured skills. Time limits and graceful closing still apply.
4. Coverage analysis is asynchronous. A one-turn lag may be acceptable; stale writes, duplicate jobs, regressions, and invalid model output must not corrupt state.
5. Portfolio ratings require candidate-grounded evidence, an L1–L5 level, a distinct confidence value, and an understandable summary. Never fabricate quotations or convert missing evidence into a low skill rating.
6. Treat generative model output as **untrusted input**. Use deterministic validation and state guards where practical.
7. Candidate safety, privacy, assessor comprehension, and explainable results are core product concerns, not optional polish.

## High-risk areas and change boundaries

The following are **review-required**, not forbidden. Before changing them, trace callers, data ownership, failure paths, and cross-service effects. Add targeted regression tests and document material risks.

- `api/app/middlewares/tenant_resolver_middleware.rb` and authorization/JWT code: cross-tenant exposure and authentication risk.
- `api/app/channels/audio_websocket_middleware.rb` and `api/app/clients/gemini/live_client.rb`: live interview continuity, transcript ordering, and Gemini session-resumption risk.
- `api/app/services/coverage/` and `api/app/workers/coverage_analyzer_worker.rb`: candidate assessment completeness and concurrency risk.
- `api/app/services/portfolios/`, `api/app/services/fit_gap/`, corresponding jobs, and result UI: evidence, rating, confidence, and hiring-impact risk.
- `api/db/migrate/` and shared database configuration: existing-row safety, rollback, schema separation, and tenant scoping.

Do not alter auth contracts, tenant lookup, AI scoring policy, production deployment, shared database semantics, or unrelated areas as incidental cleanup. If a scoped feature requires such a change, explain the reason, its risk, and the verification needed first.

## Engineering and testing rules

- Trace the user workflow from UI to API, persistence/background job, and back to UI before proposing an implementation.
- Define acceptance criteria **before coding**, including empty/unassessed skills, missing ratings, invalid AI JSON, model failures, duplicate jobs, out-of-order updates, long text, and responsive/error/loading states where relevant.
- For important choices, compare at least two approaches by product impact, complexity, maintainability, reversibility, and failure modes. Prefer the simplest design that preserves correctness.
- Validate request input, authorization, tenant isolation, and model responses. Make writes/retries idempotent where appropriate. Use reversible migrations safe for existing data.
- Add RSpec unit/service/request/job coverage for affected backend behavior. Add Vitest and React Testing Library coverage for affected frontend behavior. Build and manually inspect all relevant frontend states.
- Prove a high-value regression test can fail: introduce a temporary fault on a scratch branch, observe the expected failing assertion, then restore the implementation and retain evidence. **Never weaken an assertion just to pass.**
- If AI writes code, review it line by line. Document any *real* incorrect or risky suggestion and how it was detected, corrected, and tested. Never invent a verification story.
- Do not claim an integration or live Gemini flow passed if it was mocked or untested; distinguish automated, manual, mocked, and blocked verification.

## Working protocol

For each substantial task, report succinctly:

1. **Observed behavior and product impact** (who is affected and how), with code paths and reproduction evidence.
2. **Expected behavior** from the PRD, or an explicit assumption if unspecified; distinguish defect from product gap.
3. **Acceptance criteria and options**, with the chosen trade-off.
4. **Focused implementation** spanning relevant backend and frontend components; preserve unrelated behavior.
5. **Verification**, including commands/results, edge cases, UI screenshots where useful, seeded fault evidence, and remaining risks.

Never claim a file was inspected, a command ran, a test passed, or a behavior was verified unless it actually happened.

## Git, commits, and pull requests

Create a feature branch from `main`; do not commit directly to `main`. Keep commits small, focused, and readable. Use [semantic commit messages](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716) in the form `<type>(<scope>): <subject>`, with the scope omitted only when it adds no useful context. Write the subject in concise, imperative present tense.

Choose the type from the primary effect of the commit:

- `feat`: add a user-visible capability or intentional product/UI behavior, including a new visual design system.
- `fix`: correct defective user-visible behavior.
- `docs`: change documentation only.
- `style`: change formatting, whitespace, or punctuation only; never use it for a production UI or behavior change.
- `refactor`: restructure production code without changing its external behavior.
- `test`: add or change tests without changing production behavior.
- `chore`: change maintenance or development tooling without changing product behavior.

Split commits that have multiple independent effects. For example, use `feat(web): apply Rakamin color palette` for a user-visible palette change and `test(web): add status indicator coverage` for a test-only change.

PRs should explain the user impact, root cause/product gap, solution and rejected alternatives, validation commands/results, risk and rollback, affected environment variables/migrations/deployment, and screenshots for frontend changes. Link the relevant issue or product requirement. A fork-to-upstream PR is appropriate if you lack write access.

## Definition of done

A change is complete only when its behavior is specified, its core path and meaningful failures are tested, data and tenant boundaries are preserved, UI states are handled, documentation matches the actual change, and the author can explain every significant design choice. Explicitly state what remains unverified.
