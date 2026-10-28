# Verification notes — Fit/Gap Reliability

Tanggal dokumentasi: 27 Oktober 2026. Branch: `feat/fit-gap-trustworthy-revamp`.

## CI

Run CI yang tercatat sukses: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40452970096. Workflow menjalankan API RSpec, migration rollback/re-apply, Web Vitest/component tests, dan production build.

## AI Verification Moment

CI menangkap defect `DoubleRenderError` pada `Api::V1::PortfoliosController#find_vacancy!`: helper merender error tetapi mengembalikan nilai truthy, sehingga action bisa berlanjut dan mencoba render lagi. Helper diubah agar eksplisit return `nil` setelah render error; request specs dan CI setelah perbaikan lulus.

## Seeded fault dan recovery

- Fault commit: https://github.com/aldxynnn/ai-interview-platform/commit/e59e85d598a595781650442fc4a77c9165f75316 — mengubah lookup menjadi `Vacancy.unscoped.find_by(id: id)`.
- Fault CI: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40261374272 — gagal sesuai harapan karena cross-tenant regression test mendeteksi bypass (19 examples, 1 failure).
- Recovery commit: https://github.com/aldxynnn/ai-interview-platform/commit/69597d629ed162a436f8e3f024ec8a8c78a5818d — mengembalikan tenant-scoped lookup.
- Recovery CI: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40261381460 — lulus.
- Fault terisolasi di branch scratch, bukan branch implementasi.

## Akurasi analisis tenant

Query `Vacancy.find_by(id: id)` saja tidak membuktikan bypass karena model memakai default scope `TenantScoped`. Implementasi menambahkan kondisi tenant eksplisit sebagai defense-in-depth; eksperimen fault memakai `unscoped` untuk benar-benar melewati default scope.

## Privasi

Portfolio generation dan exhausted Sidekiq retries menyimpan pesan error generik dan hanya mencatat kelas exception, karena pesan provider dapat berisi response body atau fragmen transcript. Regression spec memeriksa agar detail pesan provider tidak masuk ke error tersimpan atau log.

## Demo

Manual smoke test dan pemeriksaan UI telah dilakukan oleh submitter. Screenshot aktual dan video walkthrough disiapkan sebagai materi demo submission.
