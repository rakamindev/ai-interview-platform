# Run and verify the submission

## Standard setup

Use Ruby 3.3.2, Bundler 2.5.11, PostgreSQL, and Node 22+. Follow the service READMEs for environment configuration. Set `ALLOWED_ORIGINS`, database connection variables and a locally generated `SECRET_KEY_BASE`; never commit their real values. Fit/Gap comparison does not require a Gemini key or Redis. Other interview/generation workflows still require their original dependencies.

For a **new local database**, create and load the existing schema before seeding. Do not load a schema over a database with data you need to preserve.

```sh
cd api
bundle install
bundle exec rails db:create db:schema:load
bundle exec rails runner ../assessment/seed_demo.rb
WEB_CONCURRENCY=0 bundle exec rails server -b 127.0.0.1 -p 3001
```

The seed is development-only and uses an explicitly synthetic organization/candidate. Re-running it resets that demo portfolio's overrides. It writes a local JWT to ignored `web/.env.local` and IDs to ignored `assessment/private/demo.json`, without printing the token. Do not use `VITE_DEV_TOKEN` in a production deployment.

In another terminal:

```sh
cd web
npm ci
npm run dev -- --host 127.0.0.1
```

Open the synthetic portfolio's URL using the assessment/session IDs in `assessment/private/demo.json`. Select the synthetic vacancy, review the comparison, change the React rating with an assessor override, then compare/export again.

## Prepared Windows workspace

This task prepared a portable runtime in the parent workspace's `.runtime` folder. On this computer, run `assessment/Start-Demo.ps1` after database/schema setup. It starts only local background processes with hidden windows, reuses listening ports, seeds synthetic records and keeps development secrets in ignored files. `assessment/Local-Environment.ps1` can be dot-sourced before running Rails commands against that runtime. The portable runtime is not included in Git.

## Automated verification

```sh
cd api
RAILS_ENV=test bundle exec rails db:create db:schema:load
bundle exec rspec spec
cd ../web
npm test
npm run build
npx playwright install --with-deps chrome
npm run test:browser
```

`comparison_spec.rb` can run with standalone RSpec without Rails. Rails request/service specs require PostgreSQL. Browser tests use synthetic API fixtures; they are not a substitute for Rails authorization and database tests. The recording script uses the actual local API and synthetic database fixtures.

## Reproduce visual evidence and video

With API and web running and demo fixtures reset, install Playwright's recording dependency with `npx playwright install ffmpeg` in `web`, then run `node assessment/record_demo.mjs` from the repository root. When using a custom browser cache, set `PLAYWRIGHT_BROWSERS_PATH` to that same cache for both commands. This workspace uses the parent `.runtime/playwright` directory. The script captures actual API-backed screenshots, PDF/JSON exports, an assessor override, and a raw 3:05 browser recording. The only request interception in that recording intentionally simulates a network failure for the error/retry scene.

Encode the raw WebM with `assessment/demo.srt` as subtitles into `assessment/demo.mp4` using FFmpeg. The submitted recording has a separate subtitle band, so captions do not obscure application controls. `assessment/build_report.py` reads public submission links and verified test results; it refuses to build if required checks are not marked as passed. All report dependencies are ReportLab and Pillow.

The captured local walkthrough used the production Vite build and a private Rails development launcher with code reload disabled and quieter query logging. This reduced Windows file-watcher overhead; the application comparison/export code and PostgreSQL data were the same. Cold startup time and production performance were not benchmarked.

The encoder verifies the media duration and removes the blank recording startup observed before the timed scenes. It preserves the 185-second walkthrough, then burns captions. The manifest records raw duration, trimmed lead-in and final duration for review.
