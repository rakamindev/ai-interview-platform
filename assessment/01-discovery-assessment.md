# Phase 1–2 — Discovery & Product Assessment

**Author:** Senior Product Engineer (assessment)
**Branch:** `fix/portfolio-delivery-reliability`
**Date:** 2026-08-17
**App status:** API running on `http://localhost:3001`, web on `http://localhost:5173`, Redis + Sidekiq up, Postgres up.

---

## 1. Repository structure

```
.
├── api/                              # Rails 7.0.10 (API-only), Postgres, Sidekiq, Gemini
│   ├── app/
│   │   ├── auth/authorize_api_request.rb      # JWT auth (claims-trusting)
│   │   ├── channels/                          # Rack WS middlewares (audio, coverage)
│   │   ├── clients/gemini/                    # HttpClient (REST) + LiveClient (WS)
│   │   ├── controllers/api/v1/                # 8 controllers
│   │   ├── services/                          # sessions/*, portfolios/*, coverage/*, fit_gap/*, exports/*
│   │   ├── models/                            # 14 models; concern TenantScoped; Current
│   │   └── workers/                           # 4 Sidekiq workers (no ActiveJob)
│   ├── config/                               # database.yml, puma.rb, sidekiq.yml, cors, rack_attack
│   ├── k8s/                                  # deployment.yaml, deploy-sidekiq.yaml, configmap.yaml, ingress.yml
│   └── db/ (schema.rb, 9 migrations; seeds + my sample_data.rb)
└── web/                               # React 18 + TS strict, Vite 6, Tailwind, Radix, Jotai
    └── src/ (pages, components, services, stores, hooks, types)
```

Both services form a single repo. The backend shares its Postgres instance with a legacy platform ("rakamin-api") — `public.organizations` and `users` data models in a shared DB; AI-interview tables live in the dedicated `ai_interview` schema.

## 2. How to run the project

1. `api/`: Ruby 3.3.2 (rbenv), `cp config/application.yml.sample config/application.yml` + fill secrets, `bundle install`, start Postgres + Redis, `rails db:create db:migrate db:seed`, `bundle exec sidekiq ...`, `rails server` (port 3001).
2. `web/`: `npm install`, copy `.env.example` to `.env` (point `VITE_API_BASE_URL` at `http://localhost:3001/api/v1`), `npm run dev` (port 5173).

Environment notes:
- No Ruby version manager was present; I installed rbenv + Ruby 3.3.2.
- Redis (Homebrew) had a broken `loadmodule` directive in `redis.conf` (referencing a `redisbloom` module that didn't ship with the bottle) — fixing `redis.conf` was required before Redis would boot. This is an environment issue, documented here rather than silently worked around.
- `application.yml.sample` is the tracked file; `application.yml` (with secrets) is git-ignored. The repo itself contains **no committed secrets**.
- Puma cluster mode crashed on macOS (`objc initialize after fork`); I run `WEB_CONCURRENCY=0` (single worker) locally. This is a dev-machine issue, not a repo defect.

## 3. Current architecture

**Backend — Rails API + Sidekiq + Gemini + raw Rack WebSockets (no ActionCable).**
- Multi-tenancy is app-level: `TenantScoped` concern adds a `default_scope` on `tenant_id` and assigns it on create; tenancy resolved per request by `TenantResolverMiddleware` (JWT `scheme` claim → `X-Tenant-Scheme` header → referer host) into `Current` (RequestStore-backed thread-locals).
- Auth is JWT-only (`AuthorizeApiRequest`): the token's `user_id` and `role` claims are **trusted without a DB lookup**; `role` from claims gates assessor endpoints.
- The live interview is a WebSocket proxy between the browser (16kHz PCM) and Gemini's Live API (24kHz), with transcript turn capture, coverage map updates (Sidekiq + pub/sub), reconnect with a Gemini resumption token, and time-ceiling/coverage-driven auto-end.
- After a session ends, `Sessions::EndHandler` creates the portfolio and enqueues `PortfolioGeneratorWorker` (Gemini Pro) to generate a structured skill portfolio. Fit/gap analysis compares the portfolio against vacancy requirements.

**Frontend — SPA with react-router v7.**
- Assessor plane (`/assessments`, `/vacancies`, session monitor, portfolio, transcript, fit/gap) behind `ProtectedRoute` + `AssessorLayout`.
- Candidate plane (`/interview/:token`) public: hardware check → live audio interview → completing when coverage is done.
- Jotai stores for auth/tenant; axios client with a Bearer-token interceptor and a `data`-envelope unwrap (harmless since the backend returns top-level payloads); `usePolling` for interval-driven refresh.

## 4. Main user workflow (end-to-end)

1. **Assessor** creates an **assessment** (name, time limit, language, ordered skill list with L1–L5 behavioral anchors). A background job compiles a `system_prompt`.
2. **Assessor** opens the invitation page and creates a **session** → gets a shareable invite link (token).
3. **Candidate** opens the invite link, passes a hardware check (mic/speaker/network), and takes a **live AI audio interview**. Gemini probes skills; the coverage map tracks each skill as `not_yet → initiated → partial → covered`; transcript turns are stored.
4. When everything is covered, time runs out, or someone ends manually, the **session ends** (`EndHandler`).
5. **Portfolio generation** runs asynchronously: Gemini Pro reviews transcript + coverage and emits configured/discovered skills with level (1–5), confidence (high/medium/low), evidence quotes, and a competency summary.
6. **Assessor** reviews the portfolio, can **override** a skill level, run a **fit/gap** comparison against a vacancy, and **export** PDF/JSON.
7. Decision: recommended for interview / not recommended etc. is presented in the fit/gap narrative.

**Where AI participates:** live questioning + transcription (Live API), coverage-state analysis (Flash), portfolio generation (Pro), fit/gap narratives (Flash). **Where data is created/transformed:** coverage_maps + transcript_turns (interview), portfolios + portfolio_skills (generation), fit_gap_reports (comparison), assessor_overrides (assessment).

## 5. Database / data-model overview

Tables in the `ai_interview` schema (see `db/schema.rb`):
- `assessments` (+ `assessment_skills`) — the recruitment brief.
- `sessions` (+ `transcript_turns`, `coverage_maps`) — one interview instance; `invite_token` is the candidate credential.
- `portfolios` (+ `portfolio_skills`, `assessor_overrides`) — AI-generated result.
- `vacancies` (+ `vacancy_skills`) — roles to compare against.
- `fit_gap_reports` — cached comparisons.
- `skill_taxonomies` — reference taxonomy for configuring skills.
- `users` (shared), `organizations` (shared, `public` schema).

Key semantics: `ai_level`/`expected_level`/`override_level` are L1–L5 integers; `confidence` is high/medium/low and derived from `probe_count` and coverage state; `generation_status` ∈ pending/generating/complete/failed.

## 6. API overview

Routes (all JSON under `/api/v1`):
`/health`, `/auth/login`, `/assessments` CRUD + `/assessments/:id/sessions`, `/sessions/:id` + `end_session` + `coverage` + `transcript` + `portfolio`, `/sessions/:token/candidate` + `/audio_complete` (public, invite token), `/portfolios/:id/export` + `fitgap` + `regenerate_fitgap`, `/portfolio_skills/:id/override`, `/skill_taxonomies`, `/vacancies` CRUD. WebSocket: `/ws/sessions/:id/audio?token=…` (candidate + JWT), `/ws/sessions/:id/coverage?token=…` (assessor monitor).

## 7. Frontend architecture

Pages: AssessmentList/New/Edit/Invite, Vacancy List/New/Edit, LiveMonitor, Portfolio, Transcript, FitGapReport, Interview (candidate), Login/Signup. Design built on shadcn-style Radix primitives. State via Jotai atoms (`authAtom`, `tenantAtom`). Data via typed service modules; `VITE_DEV_TOKEN`/`VITE_DEV_TENANT_ID` seed the dev session. Interview audio is handled by `useAudioWebSocket` + `useAudioCapture`/`useAudioPlayback` (AudioWorklet, PCM). Mostly solid loading/empty/error states; a few `as any` casts; **no tests, no zod usage** despite being a declared dependency.

## 8. Testing situation

- **Zero automated tests** in the entire repo (no `spec/`, no `*.test.*`). `.rspec` already references a missing `spec_helper.rb`.
- Test gems are declared (`rspec-rails`, `factory_bot_rails`, `faker`, `database_cleaner`, `timecop`) but never used.
- The test database (`rakamin_test`) exists but **has no `ai_interview` schema**, and `schema.rb` does not create the schema — so `db:schema:load` into a fresh test DB would fail; full migration replay is required. This is a repo gap I will fix as part of building test infrastructure.
- No CI, no static analysis, no coverage.

## 9. Initial product findings

- The core product loop (interview → portfolio → fit/gap → hiring decision) is coherent and the live-audio candidate experience is thoughtfully engineered (hardware checks, reconnect/resume, mute gating during AI speech).
- Tenant isolation relies on a `default_scope` that silently **vanishes outside request context** (e.g., all Sidekiq workers), and `Portfolio`/`FitGapReport`/`PortfolioSkill` lookups are not explicitly tenant-scoped.
- The most valuable output of the product — the **portfolio** — is the least protected piece of the pipeline: the lifecycle around session-end → generation → delivery has several silent-failure and stuck-state paths (see Problem Inventory).

## 10. Potential P0–P3 problems (initial list)

See `02-problem-inventory.md` for full details, evidence, and severities. Headline items:
1. **P1 — Portfolio delivery can silently stall forever** (stuck `pending`/`generating`, no recovery, silent enqueue loss).
2. **P1 — Session-end race/double-execution** (two concurrent ends both enqueue generation; narrow window → `RecordNotUnique` → 500).
3. **P1 — Cross-request tenant state leak** (`RequestStore::Middleware` referenced but never mounted → stale `Current.*` on reused threads).
4. **P1 — JWT claims trusted without DB verification** + unverified-token tenant resolution (+WS endpoints without role checks).
5. **P2 — `DELETE /assessments/:id` returns 200 even when deletion is restricted** (verified: 200 but record remains).
6. **P2 — `coverage` analyzer failures silently swallowed** (`retry: 0`) → stale live map.
7. **P2 — `regenerate_fitgap` destroys the cached report before regenerating** → data loss if job fails.
8. **P3 — No per-request RequestStore clear / duplicate-job protection / pagination on several list endpoints / UX polish gaps.**

## 11. Risks / constraints

- No real `GEMINI_API_KEY` in this environment (placeholder) → portfolio/fit-gap generation cannot be exercised end-to-end against the real model. All AI-touching tests will stub the client.
- The audio WS middleware (803 lines) and Gemini Live client are the most complex, fragile, and untested code.
- Shared DB with a legacy system constrains schema/tenant changes (must not break `public.organizations`).
- Long-lived audio WebSockets + Puma threading make concurrency bugs real but timing-dependent.
- UU PDP: candidate speech transcripts and evidence quotes are personal data; there is no data-retention, minimisation, or redaction story (see `02-problem-inventory.md`).

## 12. Recommended area to investigate deeper

The **session → portfolio → delivery** lifecycle. It sits at the product's core value (a candidate's hireability signal), touches backend transactions, Sidekiq jobs, API contracts, and frontend states, and is both fully demonstrable and fully testable without a live Gemini key. The rest of the assessment proceeds with this as the focus, with the security/tenancy findings documented for a follow-up release.