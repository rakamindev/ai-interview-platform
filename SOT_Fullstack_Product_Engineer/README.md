# SOT — Fullstack Product Engineer Case Study

Dokumen ini membantu mengerjakan case study `rakamindev/ai-interview-platform` secara bertahap dan terukur.

## Isi paket

- `PRD.md` — konteks produk, tujuan, ruang lingkup, pengguna, risiko, dan definisi keberhasilan.
- `UI-GUIDELINE.md` — panduan kualitas UI/UX tanpa mengasumsikan desain ulang total.
- `IMPLEMENTATION_PLAN.md` — tahapan kerja, checkpoint, bukti yang perlu dikumpulkan, dan acceptance gates.
- `ENVIRONMENT_SETUP.md` — panduan audit, konfigurasi, dan verifikasi runtime/tools sistem.
- `PRODUCT_DOMAIN_IMMERSION.md` — pemetaan alur produk, persona, kepatuhan UU PDP, dan data sensitif.
- `AUDIT_GAP_ANALYSIS.md` — hasil audit end-to-end, verifikasi anomali, dan matriks temuan GAP-01 s/d GAP-08.
- `SOLUTION_DESIGN.md` — rancangan solusi teknis, trade-offs, strategi testing, dan acceptance criteria Fase 3.
- `IMPLEMENTATION_REPORT.md` — laporan implementasi kode, hasil migrasi, eksekusi test, dan bukti verifikasi Fase 4.
- `SEEDED_FAULT_AI_VERIFICATION.md` — bukti pengujian seeded fault test (backend & frontend) serta catatan AI verification moment Fase 5.
- `AGENTS.md` — aturan wajib bagi AI coding agent dan developer.
- `EXECUTION_PROMPT.md` — prompt utama untuk menjalankan workflow bersama coding agent.

## Prinsip utama

1. **Audit sebelum memutuskan fitur.** Jangan mengarang bug atau mengubah kode sebelum repository dijalankan dan alurnya dipahami.
2. **Pilih satu vertical slice bernilai tinggi.** Perubahan harus mencakup backend dan frontend, serta model/data bila memang diperlukan.
3. **Minta persetujuan sebelum pindah fase.** Setelah setiap fase, laporkan temuan dan tunggu persetujuan pengguna.
4. **Jaga perubahan tetap terukur.** Hindari refactor luas yang tidak dibutuhkan oleh masalah terpilih.
5. **Semua klaim harus punya bukti.** Jangan mengklaim tes lulus, UI sudah diverifikasi, atau bug ditemukan tanpa menjalankannya.
6. **Jangan menyimpan rahasia atau data kandidat nyata.** Gunakan data sintetis untuk pengujian dan screenshot.

## Urutan penggunaan

1. Baca semua dokumen.
2. Buka repository dan ikuti README masing-masing service.
3. Jalankan `EXECUTION_PROMPT.md` pada coding agent yang dapat membaca repository.
4. Mulai dari Fase 0 — inspeksi dan setup.
5. Jangan lanjut ke fase berikutnya sebelum checkpoint disetujui.

## Catatan

Dokumen brief menyebut tenggat “Wednesday 19 August, 13:00 WIB” tanpa tahun yang jelas. Verifikasi tenggat melalui portal rekrutmen. Dokumen ini tidak mengasumsikan tenggat baru.
