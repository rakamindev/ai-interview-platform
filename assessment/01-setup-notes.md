# Step 1: Setup and local exploration notes

Machine: macOS (Apple Silicon), Homebrew. No Docker. Date: 2026-10-23.
Branch: `feat/candidate-assessment-revamp` off `main` (`b836d02`).

## What was installed

| Piece | Version | How |
|---|---|---|
| Ruby | 3.3.2 (matches `api/.ruby-version`) | `rbenv install 3.3.2` |
| PostgreSQL | 16.15 | `brew install postgresql@16`, `brew services start postgresql@16` |
| Redis | brew `redis` | `brew services start redis` (instead of the Docker command in the README) |
| Node / npm | 26.10.0 / 11.19.1 | already installed |
| Rails / Sidekiq / Puma | 7.0.10 / 7.3.10 / 5.6.9 | `bundle install` |
| Vite | 6.4.5 | `npm install` |

## Run commands that work on this machine

```bash
# api/
bundle exec rails db:create db:migrate db:seed
bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml
WEB_CONCURRENCY=0 bundle exec rails server -p 3001

# web/
npm install && npm run dev   # http://localhost:5173
```

Local config lives in git-ignored files only: `api/config/application.yml`
(`SECRET_KEY_BASE` from `openssl rand -hex 64`, `DB_USERNAME` = macOS user, empty password,
`ALLOWED_ORIGINS=http://localhost:5173`) and `web/.env` (API on port 3001, dev JWT minted with
`JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: 'test-corp' })`).

Smoke check (verified): `/health` 200; `/api/v1/assessments`, `/vacancies`,
`/skill_taxonomies` 200 with the admin token, 403 without it; the web Assessments page loads
with no console errors and its API call returns 200 through CORS. Seeds create org
`test-corp` (id 1) and 22 B7 skills.

## Setup friction found (each is a small onboarding defect)

| # | Where | What happened | Workaround used |
|---|---|---|---|
| S1 | `api/config/puma.rb` | `workers` defaults to 2 with `preload_app!`. On macOS every forked worker crashes on the first request (`objc ... fork() was called ... Crashing instead`), so every request got an empty reply. | `WEB_CONCURRENCY=0` (Puma single mode). Alternative: `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES`. |
| S2 | `api/bin/*` | `bin/rails`, `bin/rake`, `bin/bundle` are committed without the executable bit (`-rw-r--r--`), so `bin/rails` gives "permission denied". | `bundle exec rails ...` |
| S3 | `web/.env.example` | Points at port 3000, but the API listens on 3001 (`puma.rb`, README). | Set `VITE_API_BASE_URL=http://localhost:3001/api/v1`, `VITE_WS_BASE_URL=ws://localhost:3001`. |
| S4 | `api/README.md` | Says `cd ../ai-interview-web` (old repo layout; it is `web/` now) and lists `GEMINI_ANALYSIS_MODEL`, but the code reads `GEMINI_FLASH_MODEL` (`coverage/analyzer.rb`, `fit_gap/engine.rb`). | Followed the code and the `.sample` file. |
| S5 | `application.yml.sample` vs README | Verified: `generateContent` on `v1` returns 404 for the sample ids (`gemini-2.0-pro-001`, `gemini-2.0-flash-001`) and for the README's `gemini-2.5-pro` ("no longer available to new users"). `gemini-3.1-pro-preview` is 404 on `v1` too (the client hardcodes `v1`). `gemini-3.5-flash` worked but returned 503 under load. | Local only: `GEMINI_PRO_MODEL` and `GEMINI_FLASH_MODEL` = `gemini-2.5-flash`. See finding N2. |
| S6 | `web/` | No lockfile in the repo; `npm install` creates `package-lock.json`, so installs are not reproducible. npm 11 also skips esbuild's postinstall (esbuild still runs via its platform package). | Lockfile committed with the test harness (`3584a9e`) so CI can run `npm ci`. |
| S7 | `api/README.md` | `SECRET_KEY_BASE` "must match rakamin-api". That service is not part of this repo, so locally any value works; the shared-secret coupling is a constraint signal, not a setup step. | Generated a local value. |
| S8 | Sidekiq in development | The worker process keeps the code it booted with; after changing a service or worker, jobs still ran the old code (seen as a NoMethodError from the pre-change engine). | Restart Sidekiq after backend changes. |

## Noticed during setup, to verify in Step 3

- `TenantResolverMiddleware` picks the tenant from the JWT `scheme` claim using
  `decode_without_verification`, then falls back to the `X-Tenant-Scheme` header, then the
  Referer host. Need to check whether the same token is verified afterwards and whether a token
  without a `scheme` claim can choose any tenant through the header.
