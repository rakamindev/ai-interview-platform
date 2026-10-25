# Run and verify the review workflow

Requirements: Docker Compose, Node >=22.12, npm. Native Ruby installation and Gemini credentials are not needed for the selected fit/gap workflow. The original live audio interview and AI portfolio generation still need valid Gemini configuration; they are not simulated by this change.

## Windows setup (this workstation)

Repository: `C:\Users\Dixon\Documents\Project\ai-interview-platform`. Docker is available in the Ubuntu WSL distribution as root. The containers use their own database and Redis, not the existing Windows PostgreSQL service. Port 5173 is already occupied, so this project uses 5174.

From the repository root in PowerShell:

```powershell
wsl -d Ubuntu -u root -- bash -lc 'cd /mnt/c/Users/Dixon/Documents/Project/ai-interview-platform && docker compose build api'
wsl -d Ubuntu -u root -- bash -lc 'cd /mnt/c/Users/Dixon/Documents/Project/ai-interview-platform && docker compose run --rm api bundle exec rails db:create db:migrate review:demo'
wsl -d Ubuntu -u root -- bash -lc 'cd /mnt/c/Users/Dixon/Documents/Project/ai-interview-platform && docker compose up -d --no-build'
cd web
npm ci
Copy-Item .env.example .env
npm run dev -- --host 127.0.0.1 --port 5174
```

Keep a WSL session open while using Docker on this workstation. If WSL is shut down, restart the services with Compose. The development API command removes its stale server PID file before booting.

Compose uses one development Puma process and a polling file watcher. Inotify events on Windows bind mounts did not reliably reload both original Puma workers, which left an old PDF exporter in memory during local testing. Polling avoids stale code; restart the worker after changing job or service code because Sidekiq does not reload it automatically.

## Linux / macOS

```sh
docker compose build api
docker compose run --rm api bundle exec rails db:create db:migrate review:demo
docker compose up -d --no-build
cd web
npm ci
cp .env.example .env
npm run dev -- --host 127.0.0.1 --port 5174
```

Open http://localhost:5174. Synthetic local-only login: `assessor@example.test`, password `local-demo-only-2026`. Set `DEMO_PASSWORD` when first running the seed task to choose another local fixture password. These documented fixture values and Compose database/JWT values are not production credentials. Do not deploy this development Compose configuration to the Internet.

Use assessment -> Results -> choose the synthetic Backend Engineer vacancy -> Run Fit/Gap Analysis. The seed prints the actual IDs. On a fresh database the direct route is `/assessments/1/sessions/1/fitgap/1`. Review quotes, human provenance, and the Communication requirement without a rating. Test the follow-up filter, refresh, JSON/PDF download, and transcript link.

## Verification

```sh
docker compose run --rm -e RAILS_ENV=test api bundle exec rails db:create db:migrate
docker compose run --rm -e RAILS_ENV=test api bundle exec rspec
docker compose run --rm -e RAILS_ENV=test api bundle exec rails runner script/verify_review_migration.rb
cd web
npm test
npm run build
npx playwright install chromium ffmpeg
npm run test:e2e
```

On this Windows workstation run Docker commands via the WSL prefix above. Browser tests use installed Chrome locally and Playwright Chromium in CI. Set `CI=true` locally to use installed Playwright Chromium instead of Chrome. The tests expect the seeded API and frontend to be running; they use only synthetic data. `e2e/review.spec.ts` verifies real API flows plus explicitly labeled response simulations for failure/long-text/empty UI states. `e2e/walkthrough.spec.ts` records the real workflow for the demo.

## Failure recovery and deployment notes

- Fit/gap processing does not call Gemini. Portfolio-generation provider responses are validated and saved atomically; missing ratings remain absent, and human reviews survive regeneration.
- A queued report has a two-minute lease. Lost jobs become retryable through an explicit refresh. A process crash between DB commit and Redis enqueue therefore cannot cause a permanent spinner. This bounded recovery is the chosen trade-off instead of introducing a transactional outbox.
- The last successful snapshot survives refresh or queue failure. The server blocks comparison exports until the digest matches current source data.
- A human override invalidates comparison snapshots while holding the same portfolio row lock used by generation. Vacancy/skill changes are detected by content digest on the next read.
- Bump `FitGap::Snapshot::VERSION` when comparison semantics change so cached results require refresh.
- Duplicate job delivery uses the report's generation token and portfolio lock; obsolete jobs cannot replace a newer request.
- Deploy the additive migration before new code. Drain old two-argument FitGapGeneratorWorker jobs before deploying the new three-argument worker contract. Rollback removes lifecycle metadata but preserves existing reports and ratings. An application rollback restores old narrative behavior and lacks the new security checks, so it is an operational fallback, not a safe long-term state.
- This is a focused review-workflow hardening, not a whole-product security or legal certification. Other interview/WebSocket paths, retention/deletion workflows, and external provider privacy agreements need a separate review.
