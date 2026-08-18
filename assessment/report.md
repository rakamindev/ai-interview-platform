# Assessment Review Revamp

Tanggal verifikasi: 18 Agustus 2026, Asia/Jakarta

Branch: `feat/assessment-review-revamp`

Base project: `github.com/rakamindev/ai-interview-platform`

## Scope

Implementasi mengikuti brief yang meminta perbaikan assessor review pada portfolio dan Fit/Gap report. Brief menginstruksikan clone repository yang sudah ada, bukan membuat repository baru. Karena itu tidak ada repository private baru yang dibuat dan tidak ada push atau pull request yang dijalankan.

## Delivered behavior

### Portfolio review

- Rating yang hilang atau invalid disimpan sebagai `not_assessed`, bukan dipaksa menjadi level tertinggi.
- Semua configured skill tetap muncul walaupun model tidak mengembalikan rating.
- Level model hanya menerima integer 1 sampai 5 atau numeric string yang valid.
- Evidence dibatasi tiga kutipan dan 500 karakter per kutipan.
- Summary dibatasi 2.000 karakter.
- Persistensi skill dilakukan dalam transaction agar kegagalan di tengah batch tidak meninggalkan portfolio parsial.
- Error generation yang dikirim ke client menggunakan pesan aman dan tidak menyalin exception mentah.
- Regeneration memakai generation token dan lock window untuk mencegah job lama menimpa hasil job baru.

### Fit / Gap review

- Required level menggunakan kontrak `required_level` yang sama dengan frontend.
- Matching skill menormalisasi whitespace dan case tanpa menimpa skill duplicate secara diam-diam.
- Skill yang tidak punya rating reliable menghasilkan `not_assessed`, candidate level null, dan delta null.
- Override assessor ditandai eksplisit pada comparison.
- Report memiliki state `pending`, `generating`, `complete`, dan `failed`.
- Request GET hanya membaca report. Trigger awal memakai satu attempt dan polling tidak membuat job baru pada setiap 404.
- Queue marker, lock, dan token membatasi duplicate enqueue dan stale worker.
- Override menginvalidasi report terkait secara tenant-scoped dan menjadwalkan recalculation.

### Tenant and failure-path safety

- Portfolio, portfolio skill, session, dan vacancy yang disentuh endpoint assessor diverifikasi melalui tenant resource access.
- Worker Fit/Gap memeriksa tenant vacancy terhadap tenant session portfolio.
- Migration mempertahankan row lama, menambahkan status secara backward-compatible, dan menandai report lama untuk regeneration karena contract comparison berubah.
- UI membedakan loading, generating, failed, empty, not assessed, low confidence, dan ready state.
- Export error ditampilkan ke assessor tanpa silent failure.

## Files of interest

- `api/app/services/portfolios/result_normalizer.rb`
- `api/app/services/portfolios/generator.rb`
- `api/app/services/fit_gap/comparator.rb`
- `api/app/services/fit_gap/engine.rb`
- `api/app/workers/fit_gap_generator_worker.rb`
- `api/app/controllers/api/v1/portfolios_controller.rb`
- `api/app/controllers/api/v1/portfolio_skills_controller.rb`
- `api/app/services/api/v1/tenant_resource_access.rb`
- `api/db/migrate/20260818000000_add_portfolio_rating_status.rb`
- `api/db/migrate/20260818000001_add_fit_gap_generation_state.rb`
- `web/src/pages/portfolio/PortfolioPage.tsx`
- `web/src/pages/fitgap/FitGapReportPage.tsx`
- `web/src/components/portfolio/SkillPortfolioCard.tsx`
- `web/src/components/fitgap/ComparisonTable.tsx`

## Verification evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Frontend unit tests | Passed | `npm test`: 2 tests passed, 0 failed |
| Frontend production build | Passed | `npm run build`: TypeScript and Vite build exited 0 |
| Local browser smoke | Passed | Vite opened `/login`, title `AI Interview`, form snapshot present |
| Browser console after fix | Passed | No console errors; favicon 404 was fixed with local SVG asset |
| Diff whitespace check | Passed | `git diff --check` reported no whitespace errors |
| API service specs | Not executable in current host | Ruby/Bundler/Rails are not installed |
| API runtime integration | Not executable in current host | Docker daemon is unavailable, so Rails/Postgres/Sidekiq stack could not be booted from the repository |

The API specs are present under `api/spec/` and cover missing ratings, invalid levels, bounded evidence, malformed model output, label normalization, required-level contract, not-assessed comparisons, and override provenance. They must be run with the repository's Ruby 3.3.2 toolchain.

## AI verification moment

A deterministic seeded fault fixture injects malformed model output in the normalizer specs, including malformed JSON and a malformed configured-skill collection. The expected result is a safe failure before skill persistence, rather than a fabricated rating or partial portfolio. No external AI provider was consulted for this implementation.

The browser evidence is limited to a local login-page smoke test because the API runtime was unavailable. No end-to-end result screenshot, video walkthrough, PR link, or remote publication was created.

## Trade-offs and follow-up

The implementation favors explicit safe states over silently presenting incomplete AI output. A legacy Fit/Gap row is retained but marked for regeneration by the migration so the old `expected_level` payload cannot be mistaken for the new contract.

The current verification proves the frontend compile, unit seam, local browser boot, and static backend changes. It does not prove live Rails request, migration, PostgreSQL constraint, Gemini failure, or Sidekiq behavior until Ruby dependencies and the container/database runtime are available.

No code comments were added to the new implementation files. Existing upstream comments outside the changed behavior were preserved.
