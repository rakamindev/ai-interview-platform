# Progress

> Rewrite this file (don't append) at the end of each task.

_Last updated: 2026-10-20_

## Completed
- **Eksekusi Temuan P0 (F-01, F-02, F-03)**:
  - **F-01 (Hasil jujur & tidak ada Gap palsu)**: Enum `assessment_status` (`assessed`, `insufficient_evidence`, `not_assessed`), `status_reason`, `legacy_ai_level`. Generator deterministic AC-G1 menang atas klaim LLM. Fit/gap tidak menilai skill unassessed sebagai Gap.
  - **F-02 (Keamanan multi-tenant / IDOR)**: Scoping tenant di semua endpoint portfolio, fitgap, export, override. 404 pada cross-tenant (AC-S1). Validasi input integer & format (AC-S2).
  - **F-03 (Override bertahan & idempotensi job)**: Update in-place tanpa `destroy_all` menjaga override utuh. Concurrency lock (`with_lock`), 409 conflict, atomisitas transaksi, error mapping terstandar.
- **Eksekusi Temuan P1 (F-04, F-05, F-06, F-07, F-08, F-09) & P2 (F-15, F-16)**:
  - **F-04 (Laporan fit/gap basi terdeteksi - AC-D6, AC-F6, AC-W6)**:
    - Model `FitGapReport` menghitung `source_fingerprint` (SHA-256 hash dari portfolio `generated_at`, override `overridden_at`, vacancy `updated_at`, dan skill vacancy).
    - `stale?` mendeteksi ketidaksesuaian secara dinamis.
    - API `GET /api/v1/portfolios/:id/fitgap/:vacancy_id` mengembalikan `stale: true/false`.
    - Web UI (`FitGapReportPage.tsx`): Menampilkan banner peringatan laporan usang berwarna amber dengan tombol "Buat Ulang Laporan" saat `report.stale === true`. Laporan lama tetap terlihat utuh.
    - Perbaikan `PortfolioSkillsController`: Override tidak lagi menghancurkan (`report.destroy`) laporan lama, menjaga histori laporan tetap dapat dibaca hingga di-regenerate.
  - **F-05 (Kontrak payload Required level & penanda override - AC-F4, AC-W5)**:
    - Payload `skill_comparisons` menyertakan `required_level`, `is_override`, `level_source`, `tentative`, `assessment_status`.
    - `ComparisonTable.tsx` menampilkan kolom Required terisi, penanda ✏ untuk override dengan tooltip catatan, serta hasil sementara bertanda khusus.
  - **F-06 (Banner durasi sesi & konteks cakupan - AC-W3)**:
    - `PortfolioPage.tsx`: Menampilkan banner konteks sesi di bagian atas ("Sesi diakhiri lebih awal oleh kandidat (1 menit dari batas 10 menit)") dan ringkasan cakupan ("X dari Y skill dinilai").
  - **F-07 (Validasi output LLM & verifikasi kutipan - AC-G1, AC-G2, AC-G3)**:
    - Level dibatasi 1..5, kutipan dicocokkan hanya dengan turn pembicara kandidat.
  - **F-08 (Penanganan kegagalan portfolio & status error - AC-W4)**:
    - `PortfolioPage.tsx`: Pemetaan kode error ramah pengguna (`model_timeout`, `model_unavailable`, `model_not_found`, `invalid_model_output`, `model_output_truncated`).
    - Banner peringatan regenerasi gagal tanpa menghilangkan hasil portfolio `complete` sebelumnya.
    - Retry button dengan penanganan 409 Conflict.
  - **F-09 (Filter parameter log sensitif - AC-S3)**:
    - Initializer `api/config/initializers/filter_parameter_logging.rb`: memfilter `passw`, `secret`, `token`, `_key`, `crypt`, `salt`, `certificate`, `otp`, `ssn`, `candidate_name`, `assessor_notes`, `text`.
- **Harness testing RSpec**:
  - 49 spec lolos (unit model `FitGapReport`, `AssessorOverride`, `PortfolioSkill`, services `Portfolios::Generator`, `FitGap::Engine`, request controllers, initializers parameter filtering, dan skenario integrasi E2E-1, E2E-2 dengan stale lifecycle, E2E-3, E2E-4).
- **Web Frontend**:
  - `pnpm build` (`tsc && vite build`) 100% lolos tanpa type error (tanpa `any` inline cast).

## Next
- Review git diff oleh user dan commit / push manual.
- Commit/push/branch: hanya oleh user.
