# Phase 3 — Problem Inventory (P0–P3)

Each finding: severity, problem, affected user, current vs expected behavior, impact, evidence, missing-spec vs defective-implementation, scope.

Legend — **B** backend, **F** frontend, **S** full-stack seam.

---

## P1-01 — Portfolio delivery can silently stall forever (SELECTED for implementation)

- **Severity:** P1
- **Problem:** An ended interview session does not reliably converge to a generated portfolio. Several independent failures leave a portfolio permanently `pending` or `generating`, and the product has no automatic or user-facing recovery path.
- **Affected users:** Assessors/recruiters (cannot evaluate the candidate), candidates (results silently vanish), the hiring process (stalled decisions).
- **Current behavior:**
  - `EndHandler` runs `PortfolioGeneratorWorker.perform_async` **after** the DB transaction commits (`api/app/services/sessions/end_handler.rb:39`). If Redis is down/slow at that instant, `perform_async` raises → HTTP 500, but the session is already `ended` with a `pending` portfolio and **no job was ever scheduled**. Nothing retries a `pending` portfolio.
  - If a job is lost (e.g., Redis restart/flush) or the worker process dies mid-run, the portfolio stays `generating`. `PortfoliosController#show` returns `202 {status:"generating"}` forever (`api/app/controllers/api/v1/portfolios_controller.rb:13-14`), and `regenerate` refuses anything but `failed` (`:35-37`). No TTL, no heartbeat, no recovery.
  - `save_skills` does `destroy_all` then recreates skills with **no transaction** (`api/app/services/portfolios/generator.rb:154`) — a crash mid-save leaves a `generating` portfolio with zero skills.
- **Expected/ideal behavior:** Every ended session converges to `complete` or a clearly `failed` status with a recovery path within a bounded time; transient pipeline failures self-heal.
- **Impact:** The product's core deliverable (a candidate's skill profile) can be lost with no way to recover. High business + trust impact.
- **Evidence:** Runtime reproduction of `pending`-forever and `generating`-forever paths via `EndHandler` code walk + rejected `regenerate` (422) when status ≠ `failed`; `PortfolioPage` polls `generating` forever with no timeout (`web/src/pages/portfolio/PortfolioPage.tsx:55-56,157-167`).
- **Missing spec vs defective implementation:** Defective implementation (reliability boundaries missing) + partially missing spec (no definition of "what happens if generation never completes").
- **Scope:** B + F.

## P1-02 — Session-end race & duplicate execution

- **Severity:** P1
- **Problem:** Two concurrent end requests (manual button + WS auto-end + `audio_complete`) both pass the pre-check and run `EndHandler`, producing duplicate generation jobs; a narrow interleaving raises `ActiveRecord::RecordNotUnique` on the `portfolios.session_id` unique index inside the transaction, rolling back the `ended` update → 500.
- **Affected users:** Assessors, candidates, platform stability.
- **Current behavior:** `Sessions::EndHandler#call` checks `@session.ended?` on a stale in-memory object, then enters a transaction (`end_handler.rb:16,26-37`); no row lock. Confirmed at runtime: 5 attempts of two concurrent `end_session` calls returned `200/200` five times — i.e., both executions completed (both enqueued generation).
- **Expected/ideal behavior:** Exactly one termination execution; second caller sees `ended`/is a no-op; no duplicate jobs; no 500.
- **Impact:** Duplicate (billable) Gemini runs, wasted jobs, risk of corrupted skill writes, and rare 500s to clients.
- **Evidence:** Reproduction above; `create_portfolio` guard `return if @session.portfolio.present?` (`end_handler.rb:59`) is a stale, non-atomic check.
- **Missing spec vs defective implementation:** Defective implementation (missing serialization).
- **Scope:** B.

## P1-03 — Cross-request tenant state leak (RequestStore never cleared)

- **Severity:** P1 (security/privacy)
- **Problem:** `config/initializers/request_store.rb` references `RequestStore::Middleware` but never mounts it. `Current.*` (tenant id/organization/user) is therefore never cleared between requests. `TenantResolverMiddleware` only sets state **when a scheme resolves** (`api/app/middlewares/tenant_resolver_middleware.rb:23-26`); a JWT-less request on a reused Puma thread inherits the previous request's tenant, so `require_tenant!` can pass against stale tenant state, and candidate-facing code can read/write scoped against the wrong tenant.
- **Affected users:** All tenants; candidate privacy.
- **Current behavior:** Reproduced by code walk; thread-local `Current` persists across requests.
- **Expected/ideal behavior:** Per-request isolation; clear `Current`/RequestStore at request end.
- **Impact:** Cross-tenant data exposure risk — high under UU PDP (personal data of candidates).
- **Evidence:** `config/initializers/request_store.rb:4` (constant reference only); `application.rb` mounts `TenantResolverMiddleware` but no `RequestStore::Middleware`.
- **Missing spec vs defective implementation:** Defective implementation.
- **Scope:** B.

## P1-04 — JWT claims trusted without DB verification; WS endpoints lack role checks

- **Severity:** P1 (security)
- **Problem:** `AuthorizeApiRequest` builds the user from `user_id`/`role` claims with no DB verification (`api/app/auth/authorize_api_request.rb:33-39`); tenant resolution decodes the token *without signature verification* (`api/app/middlewares/tenant_resolver_middleware.rb:47`); the coverage WebSocket (`coverage_websocket_middleware.rb:125-134`) and JWT path of the audio WS verify only scheme/tenant, not role.
- **Affected users:** All orgs; candidate data.
- **Current behavior:** Any token minted with `role:admin` grants full assessor access; a `student` token can subscribe to live assessor coverage.
- **Expected/ideal behavior:** Role/user verified against the platform or token trust verified; WS endpoints enforce assessor role.
- **Impact:** Privilege escalation and cross-role data exposure.
- **Evidence:** Code citation (above).

> **Scope note:** P1-03/P1-04 are security findings. They are documented and recommended for a dedicated security hardening release. They are **not** part of this implementation release, which focuses on the product-value issue P1-01 (+ P1-02 as its root cause).

## P1-05 — Test infrastructure is absent

- **Severity:** P1 (engineering)
- **Problem:** No tests anywhere; `.rspec` references a missing `spec_helper`; test DB lacks the `ai_interview` schema and `db:schema:load` cannot create it (schema creation lives only inside migration `20240101000000`).
- **Affected users:** Engineering organization.
- **Impact:** Every behavior change is unverified; regressions are invisible.
- **Evidence:** `ls spec` → does not exist; `psql rakamin_test` shows no `ai_interview` schema.
- **Scope:** B + F (infra).

## P2-01 — `DELETE /api/v1/assessments/:id` returns 200 despite failed deletion

- **Severity:** P2
- **Problem:** `Assessment` uses `dependent: :restrict_with_error` on `sessions`; `destroy` returns `false`, but the controller renders `{message: "Assessment deleted"}` with HTTP 200 unconditionally (`api/app/controllers/api/v1/assessments_controller.rb:51-54`).
- **Affected users:** Assessors.
- **Current behavior (verified):** `DELETE` returns `200 {"message":"Assessment deleted"}` and the assessment still exists (next GET → 200).
- **Expected:** 422 with an explanatory message; frontend shows the conflict.
- **Impact:** User trust (product reports success that didn't happen); data can't be cleaned up.
- **Evidence:** Runtime reproduction this session.
- **Scope:** B (+ F when a delete UI exists — currently there is no delete UI at all).

## P2-02 — Coverage analysis silently fails (no retry, errors swallowed)

- **Severity:** P2
- **Problem:** `CoverageAnalyzerWorker` uses `retry: 0` and rescues all errors (`api/app/workers/coverage_analyzer_worker.rb:6,32-35`); a failed analysis leaves the coverage map stale, and the interview's "am I fully covered / should I keep probing" signal drifts from reality.
- **Affected users:** Candidates, assessors.
- **Impact:** Interview may over-probe or end based on stale state.
- **Scope:** B.

## P2-03 — `regenerate_fitgap` destroys the report before regeneration

- **Severity:** P2
- **Problem:** `regenerate_fitgap` deletes the existing `FitGapReport` then enqueues generation (`api/app/controllers/api/v1/portfolios_controller.rb:94-95`); if the job permanently fails (`retry: 2`), the previous report is gone (data loss).
- **Affected users:** Assessors.
- **Impact:** Loss of a prior analysis; unnecessary destructive write.
- **Scope:** B.

## P2-04 — Portfolio page: indefinite generating spinner, hidden error detail, no empty state

- **Severity:** P2
- **Problem:** `PortfolioPage` polls forever while `generating` with no time budget or stuck-state UX; the `failed` state shows a generic message but never the backend `generation_error`; there is no distinct "no portfolio / waiting to be created" state.
- **Affected users:** Assessors.
- **Impact:** Confusing UX; assessor cannot tell "this will take 2 min" from "this is broken."
- **Evidence:** `web/src/pages/portfolio/PortfolioPage.tsx:55-56,157-184`.
- **Scope:** F.

## P2-05 — Role/user trust & tenant resolution UX drift

- **Severity:** P2 (cross-org correctness)
- **Problem:** `AuthenticationController#resolve_scheme` mints a token for the **first organization in the DB** (`api/app/controllers/api/v1/authentication_controller.rb:26-28`); with multiple tenants this produces cross-tenant tokens.
- **Scope:** B.

## P3-01 — Various polish items

- Transcript & session list endpoints are unpaginated.
- `json_error` vs `render json:` conventions are mixed.
- Unused code paths: `AudioRingBuffer`, `Message`, `paginated_response`, `auth_token_middleware`.
- `fitgap` uses explicit `params[:id]` portfolio lookup without tenant scoping.
- No rate limiting on assessor endpoints; CORS `*` in default `application.yml`.

---

## Priority rationale

- **P1-01 + P1-02** are selected because they attack the product's **core value** (a candidate's portfolio must exist and be correct), are provable now, and give a full-stack, testable change.
- Security findings (P1-03/P1-04) are noted as the highest-severity *next* workstream and are described but excluded to keep this release focused and reversible.