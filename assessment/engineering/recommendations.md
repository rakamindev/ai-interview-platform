# Engineering Recommendations — Assess · Harden · Release

> Scope: technical hardening & release-readiness of the two-service app (`api/` Rails, `web/` React), framed as a version **about to ship to a client**.
> Method: grounded in the source via three parallel read-only audits (security/auth, backend correctness & tests, release/ops) plus **direct verification of every Critical finding**. Compiled via `/opsx:explore` on 2026-08-17.
> Companion to `assessment/product/problem_clarity/authorized_pages.md` (product/UX layer — already resolved). All findings cite `file:line`. **Secret values are intentionally not reproduced here.**

## TL;DR — severity rollup

| Sev | Count | Headline |
|---|---|---|
| 🔴 Critical | 4 | Any network client can mint an **admin**; **cross-tenant** data access; a **live API key + DB password** are baked into the Docker image |
| 🟠 High | 8 | No backend tests; under-authorized WebSockets; deploy can't boot (no Secret/Redis); prod-unsafe seeds; no CI/observability |
| 🟡 Medium | ~8 | Job races (coverage/portfolio); fail-open tenant scope; single-replica SPOF; shallow health check |

**Do not ship without fixing `OPS-1`, `SEC-1`, `SEC-2`, `SEC-3`** — each is exploitable by any network client or leaks live client credentials.

---

## 1. Security & multi-tenancy 🔴 (highest priority)

### SEC-1 — Open signup mints admins (privilege escalation) · 🔴 Critical
`POST /api/v1/signup` is unauthenticated (`api/app/controllers/api/v1/authentication_controller.rb:6`), trusts a caller-supplied role (`:25` — `User.new(role: params[:role])`), and returns a signed JWT immediately (`:27-31`). The route is public (`api/config/routes.rb:10`) and unthrottled (only `/auth/login` is rate-limited, `api/config/initializers/rack_attack.rb`). `login` gates on `role == 'admin'` (`:15`) — but signup lets anyone **create** an admin, making the gate moot. The web signup form even exposes an "Admin" radio (`web/src/pages/auth/SignupPage.tsx`).
→ Never accept a client `role`; default to least-privilege and gate admin creation behind an authenticated admin / seed / invite. Add a `rack-attack` throttle for `/signup`.

### SEC-2 — Tenant is client-selectable; users aren't bound to an org · 🔴 Critical
`resolve_scheme` takes the tenant from the **`X-Tenant-Scheme` request header** (`authentication_controller.rb:50-55`, falling back to "first org" / `'test-corp'`), and the `users` table has no org/tenant column (`api/db/schema.rb`). So a token can be scoped to *any* tenant. Chained with SEC-1: sign up as admin → send `X-Tenant-Scheme: <victim>` → obtain a validly-signed admin token for another client's data.
→ Bind each user to an organization server-side; derive tenant from the authenticated user record, never a request header; reject scheme/user mismatches.

### SEC-3 — Cross-tenant IDOR on portfolios / fit-gap / overrides · 🔴 Critical
`Portfolio`, `PortfolioSkill`, `FitGapReport`, `AssessorOverride` do **not** `include TenantScoped` (verified: only `assessment.rb`, `vacancy.rb`, `session.rb` are scoped), and those tables have no `tenant_id`. Controllers load them by raw sequential integer id: `api/app/controllers/api/v1/portfolios_controller.rb:82,104,130,156` and `portfolio_skills_controller.rb:51`. An assessor in tenant A can read / export / override tenant B's candidate portfolios by enumerating ids.
→ Scope every portfolio-family load through the tenant-scoped `Session` (join on `sessions.tenant_id`), or add `tenant_id` + `TenantScoped`; add cross-tenant request specs.

### SEC-4 — Under-authorized WebSockets · 🟠 High
The coverage WS streams a session's live transcript with only a tenant match — **no role check** (`api/app/channels/coverage_websocket_middleware.rb:125-134`); any valid JWT (including a low-priv `user` from `rakamin-api`) can subscribe. The audio WS invite path checks only `ended?`, not `usable?` (`audio_websocket_middleware.rb:759-783`), so **revoked/expired** invite links can still open an interview (contrast `sessions_controller.rb:161-165`, which does check `usable?`).
→ Enforce assessor/admin role on the coverage WS; gate the audio WS on `session.usable?` (respect `revoked_at`/`expires_at`).

### SEC-5 — Auth trusts JWT claims (no DB re-check, no revocation); secret shared with `rakamin-api` · 🟠 High
`api/app/auth/authorize_api_request.rb` decodes and trusts role/identity claims without a DB lookup (explicitly "does NOT hit the database"); tokens cannot be revoked; `SECRET_KEY_BASE` is shared with `rakamin-api` (`api/app/lib/json_web_token.rb`), so any rakamin-issued token authenticates here until expiry. (The verified decode itself is fine: HS256 pinned + `exp` enforced.)
→ Re-load the user & re-check role/tenant per request; add a `jti` denylist or short TTL + refresh; consider an `aud` claim / a separate signing key scoped to this service.

### SEC-6 — Web token handling · 🟡 Medium
JWT is kept in `localStorage` (`web/src/stores/authAtom.ts:10,14`) → XSS-exfiltratable; `VITE_DEV_TOKEN` is an **unguarded build-time fallback** (`authAtom.ts:10`, no `import.meta.env.DEV` guard — the pattern *is* used elsewhere, e.g. `InterviewPage.tsx`). A prod build with that var set would bake a shared auth token into the public JS bundle. (`web/.env` is gitignored and empty today, so nothing leaks now.)
→ Prefer httpOnly SameSite cookies (or in-memory + refresh); wrap the dev token in `import.meta.env.DEV`; fail the prod build if it's non-empty; ship a strong CSP.

**Also (Medium/Low):** tenant is resolved from an **unverified** JWT (`api/app/middlewares/tenant_resolver_middleware.rb:47` — `decode_without_verification`); `TenantScoped`'s `default_scope` **fails open** (returns all rows when no tenant is set — `api/app/models/concerns/tenant_scoped.rb:18-24`); unauthenticated `speed_test` accepts arbitrary-size bodies, unthrottled (`routes.rb:16`).

---

## 2. Correctness & reliability 🟠

### REL-1 — Coverage probe-count race (lost updates) · 🟠 High
`CoverageAnalyzerWorker` does read-then-`update!` of `probe_count` (`api/app/workers/coverage_analyzer_worker.rb:39-49`) with `retry: 0`, enqueued once per candidate turn (`audio_websocket_middleware.rb:187`), with no per-session serialization. Two turns landing close together read the same count and both write N+1 → a lost increment can stall state advancement, which gates on `probe_count >= 2` (`api/app/services/coverage/state_engine.rb`). `create_discovered_skills` has the same check-then-create race.
→ Serialize per session (advisory lock / `with_lock` / unique job) or use atomic SQL increments; make discovered-skill creation upsert-safe.

### REL-2 — Duplicate portfolio generation / double Gemini spend · 🟡 Medium
A double session-end can enqueue two `PortfolioGeneratorWorker`s; `Portfolios::Generator` has no in-progress guard and does `destroy_all` → `create!` with no unique constraint on `(portfolio_id, skill)` (`api/app/services/portfolios/generator.rb`). Interleaving yields duplicate skills and two paid Gemini calls.
→ Guard on portfolio status, take a row lock, add a unique index on `(portfolio_id, skill)`.

### REL-3 — Failed fit/gap leaves the UI polling forever · 🟡 Medium
`FitGapGeneratorWorker` re-raises with no `sidekiq_retries_exhausted`, and `fit_gap_reports` has no status column, so a report row only appears on success; the controller returns `202 {status:"generating"}` (`portfolios_controller.rb:122`). After retries exhaust, the client never sees failure.
→ Add a failure/status signal + an exhausted handler; surface an error/retry in the UI.

### REL-4 — Latent serializer drift (assessments) · 🟡 Low→Medium
`assessments#index` returns a lighter shape than `show` (no `skills`; `api/app/controllers/api/v1/assessments_controller.rb`). It does **not** crash today (the list page doesn't read `skills`), but it's the same class as the vacancies bug fixed this session — one consumer change from a repeat. `index` also ships the heavy `system_prompt` text unnecessarily.
→ Add index-vs-show serializer contract tests; trim the list projection. (See the archived `fix-vacancy-list-skills-contract` change for the pattern and the resilient-rendering approach.)

### REL-5 — EventMachine reactor unsupervised · 🟡 Low
The whole WS/audio stack rides a single EM reactor started in a bare thread (`api/config/initializers/eventmachine.rb`); if it dies, silence-pump / reconnect / time-ceiling / auto-end timers stop silently.
→ Supervise/restart the reactor; add a health signal.

> **Already solid — don't over-invest:** Gemini HTTP client has retry/backoff/timeouts and 429 handling (`api/app/clients/gemini/http_client.rb`); LiveClient reconnect/drain and idempotent `EndHandler` (`error→manual` upgrade) are mature; DB has strong unique indexes / FKs / CHECK constraints; hot list endpoints already use `includes` (no material N+1).

---

## 3. Testing 🟠

### TEST-1 — No backend tests, and the RSpec harness isn't runnable · 🟠 High
There are **zero specs** under `api/` despite `rspec-rails` / `factory_bot` / `faker` / `database_cleaner` / `timecop` in the Gemfile, and `api/.rspec` points at a `spec_helper` that doesn't exist. None of the Critical security logic above is regression-guarded. (By contrast, `web/` now enforces a **95/95/95/90** Vitest gate — see the archived `react-unit-testing-95` change.)
→ Bootstrap `spec_helper`/`rails_helper` + factories + an assessor auth-token helper, then prioritize the highest-ROI, near-pure units **and** the security regressions:
> `coverage/state_engine`, `json_web_token`, signup/login role handling (SEC-1), tenant isolation (SEC-2/SEC-3), and index-vs-show serializer contracts (REL-4).

This also unblocks the deferred backend request spec from `fix-vacancy-list-skills-contract`.

---

## 4. Release & operations 🔴/🟠

### OPS-1 — Live secrets baked into the Docker image · 🔴 Critical
`api/config/application.yml` (working tree; gitignored, and **git history is clean** — verified) holds a real `SECRET_KEY_BASE`, `DB_PASSWORD`, a live `OPENAPI_SECRET_KEY` (Groq), and `GEMINI_API_KEY`. `api/Dockerfile:17` (`COPY . .`) with **no `api/.dockerignore`** bakes them into an image layer. Shipping that image (or a working-tree zip) leaks production-grade credentials.
→ **Rotate the Groq key + DB password now** (treat as compromised); add `api/.dockerignore` (`config/application.yml`, `master.key`, `.env`, `.git`, `log/`, `tmp/`); inject secrets at runtime; add a secret scanner (e.g. gitleaks) to CI.

### OPS-2 — Deploy can't boot from the repo · 🟠 High
k8s uses only `configMapRef` (no `kind: Secret`): `SECRET_KEY_BASE`, DB creds, Gemini/Groq keys, and `REDIS_URL` appear in **no** manifest, and there's **no Redis** provisioning (`REDIS_URL` defaults to `localhost`, `api/config/initializers/sidekiq.rb`). A deploy as-is fails to boot (no creds/secret) and Sidekiq/rate-limit/cache break. `api/k8s/configmap.yaml` still has placeholders (`<your-db-host>`, `<your-frontend-domain>`).
→ Add a templated Secret / ExternalSecrets + Redis; fill placeholders; document secret injection.

### OPS-3 — Prod-unsafe seeds (admin backdoor in a shared schema) · 🟠 High
`api/db/seeds.rb` seeds `admin@test.com` with a hardcoded default admin password (role `admin`) and `CREATE`/`INSERT`s into the shared `public.organizations` used by `rakamin-api`. Run against prod → a known-credential admin on a live client system + pollution of another app's table.
→ Guard seeds to non-prod (`return if Rails.env.production?`); remove hardcoded credentials; never manage another service's tables from seeds.

### OPS-4 — Sidekiq runs a non-existent `staging` environment · 🟠 High
`api/k8s/deploy-sidekiq.yaml:61` runs `sidekiq -e staging`, but there is no `config/environments/staging.rb` (the API runs `production`). Workers either misboot or the flag is dead/misleading → coverage scoring, portfolio & fit-gap generation at risk.
→ Run Sidekiq with `-e production` (or add a real staging env + pipeline); align `OTEL_SERVICE_NAME`.

### OPS-5 — No CI/CD, no migrations-on-deploy, no observability · 🟠 High
No `.github/` or any pipeline (verified); DB migrations are only run manually (documented in `api/README.md`, not in the deploy path); no error tracking / APM / metrics / tracing (only a dangling `OTEL_SERVICE_NAME` with no SDK). For a live-audio product, there's no visibility into exceptions, job failures, or WebSocket drops.
→ Add a pipeline (api: `rspec` + RuboCop; web: `vp check` / `vp test`; `docker build` from a clean checkout + secret scan; gated deploy) with a **pre-deploy migration Job**; add Sentry (api + web) + Sidekiq failure alerting.

### OPS-6 — HA / probes / image tags / web hosting · 🟡 Medium
Single replica for API and Sidekiq (SPOF — a crash drops in-flight interviews); `/health` is a static 200 used for readiness (can't shed a pod with a dead DB/Redis); `:latest` tag + `imagePullPolicy: Always` (non-deterministic rollbacks); `web/` has no Dockerfile / static-serve / hosting definition.
→ Run ≥2 replicas + a PodDisruptionBudget; deep readiness probe (DB + Redis); immutable image tags/digests; define the web build + hosting artifact.

---

## Recommended sequencing (release gate)

```
BLOCK RELEASE ──────────────────────────────────────────────
  1. OPS-1   rotate leaked secrets + add .dockerignore        (minutes)
  2. SEC-1   lock down signup / stop trusting client role      (hours)
  3. SEC-2   bind users↔org; derive tenant from user, not header (day)
  4. SEC-3   tenant-scope the portfolio family (IDOR)          (day)
  5. OPS-2/3 bootable deploy (Secret + Redis) + prod-safe seeds (day)
HARDEN BEFORE GA ───────────────────────────────────────────
  6. SEC-4/5 WebSocket authz + per-request auth re-checks
  7. TEST-1  bootstrap RSpec + security & serializer regressions
  8. REL-1/2/3 job races + terminal (failed) states
  9. OPS-4/5 sidekiq env, CI/CD, migrations-on-deploy, Sentry
POLISH ─────────────────────────────────────────────────────
  10. SEC-6, REL-4/5, OPS-6, and the product/UX backlog
```

---

## Context — work already completed this session

Four OpenSpec changes are archived under `openspec/changes/archive/`:

- **`authorized-pages-improvements`** — product/UX parity (41 tasks); see the companion `assessment/product/problem_clarity/authorized_pages.md`.
- **`route-aware-loading-skeleton`** — Suspense fallback renders a shell-appropriate skeleton (auth / interview / assessor).
- **`fix-vacancy-list-skills-contract`** — fixed the `/vacancies` "Something went wrong" crash (backend list now returns `skills`; frontend renders resiliently). Backend request spec **deferred** pending an RSpec harness (see TEST-1).
- **`react-unit-testing-95`** — `web/` now has an enforced 95/95/95/90 coverage gate (462 tests).

This document is the **engineering-hardening / release-readiness** counterpart to the product/UX findings already captured for the authorized pages.
