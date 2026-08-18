# Setup and Baseline Verification Report

- **Date:** 2026-08-18
- **Branch:** `assessment/trustworthy-results`
- **Assessment Scope:** AI Interview Platform
- **Status:** Baseline Established and Verified

---

## 1. Environment Summary

| Component | Repository Specification | Verified Version | Status |
|---|---|---|---|
| **OS** | macOS Darwin | macOS (Darwin 23.6.0 x86_64) | Compatible |
| **Git** | 2.x+ | git version 2.39.5 | Clean branch `assessment/trustworthy-results` |
| **Ruby** | `3.3.2` (`.ruby-version`, `Gemfile`) | `ruby 3.3.2` (via rbenv) | Verified |
| **Bundler** | `2.5.11` (`Gemfile.lock`) | `2.5.11` | Verified |
| **Node.js** | `v18+` | `v20.19.0` | Verified |
| **npm** | `9+` | `10.8.2` | Verified |
| **PostgreSQL** | `14+` | `postgresql@18` (port 5432) | Active / Accepting connections |
| **Redis** | `6+` | `redis` (port 6379) | Active / Responding PONG |

---

## 2. Setup Execution and Verification Log

### 2.1 Toolchain Activation
- Activated Ruby `3.3.2` via `rbenv`:
  ```bash
  rbenv install 3.3.2
  eval "$(rbenv init - zsh)"
  ruby -v # ruby 3.3.2 (2024-05-30 revision e5a195edf6) [x86_64-darwin25]
  ```
- Bundled dependencies in `api/`:
  ```bash
  bundle install # 30 Gemfile dependencies, 125 gems installed
  ```

### 2.2 Datastores and Database Preparation
- Started local PostgreSQL and Redis services via Homebrew.
- Prepared development and test databases:
  ```bash
  bundle exec rails db:prepare
  RAILS_ENV=test bundle exec rails db:test:prepare
  ```
- Created schemas, tables, and seeded B7 Skill Taxonomy (22 pilot skills) and default organization.

### 2.3 Backend Test Baseline Execution
- Executed characterization suite across request, service, and model specs:
  ```bash
  bundle exec rspec
  ```
- **RSpec Execution Output:**
  ```text
  Randomized with seed 31269
  .......

  Finished in 0.8392 seconds (files took 1.59 seconds to load)
  7 examples, 0 failures
  ```
- The 7 characterization examples test and prove existing baseline behaviors (including defects) for cross-tenant isolation, default level coercion, transaction handling, JWT rejection, and invite URL host routing.

### 2.4 Frontend Build Baseline Execution
- Compiled TypeScript and production bundle via Vite:
  ```bash
  cd web && npm run build
  ```
- **Build Output:**
  ```text
  > ai-interview-web@0.0.0 build
  > tsc && vite build

  ✓ 1840 modules transformed.
  ✓ built in 5.36s
  ```
- **Result:** 0 TypeScript compiler errors. Production assets output to `web/dist/`.

---

## 3. Working Tree and Artifact State

- **Branch:** `assessment/trustworthy-results`
- **Tracked Codebase:** No production code modified under `api/app`, `api/config`, `api/db`, or `web/src`.
- **Characterization Specs Added:**
  - `api/spec/spec_helper.rb`
  - `api/spec/rails_helper.rb`
  - `api/spec/requests/api/v1/portfolios_tenant_isolation_spec.rb`
  - `api/spec/services/portfolios/generator_level_default_spec.rb`
  - `api/spec/services/portfolios/generator_transaction_spec.rb`
  - `api/spec/requests/api/v1/jwt_unresolved_scheme_spec.rb`
  - `api/spec/models/session_invite_url_spec.rb`
