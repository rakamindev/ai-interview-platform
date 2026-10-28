# Implementation Plan
## Fullstack Product Engineer Case Study

**Workflow:** evidence-first, phase-gated, approval required  
**Target repository:** `rakamindev/ai-interview-platform`

> Jangan mulai dengan mengimplementasikan fitur tebakan. Fitur dan scope ditetapkan setelah audit aplikasi dan data.

## Fase 0 — Orientasi dan setup

### Tugas
- Baca README root (jika ada), `api/README.md`, dan `web/README.md`.
- Periksa versi runtime, package manager, environment variables, serta layanan yang dibutuhkan.
- Clone repository dan buat feature branch dari `main`.
- Jalankan API dan web secara lokal.
- Catat semua langkah setup yang berhasil/gagal.
- Jangan memasukkan secret ke dokumentasi, terminal capture, atau commit.

### Output
- Catatan setup.
- Versi runtime yang digunakan.
- Bukti API/web berjalan atau daftar blocker yang dapat direproduksi.
- Daftar halaman dan workflow yang berhasil dicoba.

### Gate 0
Jangan lanjut sebelum pengguna menyetujui status setup dan rencana mengatasi blocker.

## Fase 1 — Product and domain immersion

### Tugas
- Jalankan workflow produk dari awal sampai akhir sebagai pengguna.
- Petakan assessor, recruiter, hiring manager, serta kandidat yang terdampak.
- Pelajari konteks hiring/talent assessment Indonesia dari sumber yang relevan jika diperlukan.
- Petakan data kandidat dan titik pemrosesan AI yang terlihat dari kode.
- Identifikasi potensi implikasi UU PDP tanpa membuat klaim legal yang tidak diverifikasi.

### Output
- Workflow map.
- Ringkasan kebutuhan dan pain points tiap pengguna.
- Daftar data sensitif yang perlu dilindungi.
- Pertanyaan/asumsi yang belum terjawab.

### Gate 1
Minta persetujuan sebelum menetapkan temuan sebagai masalah final.

## Fase 2 — Audit end-to-end dan gap analysis

### Tugas
- Trace satu atau lebih workflow dari UI → request → API → service/model/database → response → UI.
- Inspeksi record database dengan data lokal/sintetis.
- Periksa API payload dan error responses.
- Catat perilaku aktual dan langkah reproduksi.
- Klasifikasikan temuan: missing specification atau defective implementation.
- Beri severity P0–P3 dengan dampak yang jelas.
- Catat constraint signal: blocker, ambiguitas, atau architectural debt yang perlu dieskalasikan.

### Format setiap temuan
- ID dan judul.
- Pengguna/workflow terdampak.
- Severity + alasan.
- Jenis masalah.
- Langkah reproduksi.
- Perilaku aktual.
- Perilaku ideal.
- Bukti (file/endpoint/test/screenshot).
- Dampak produk dan risiko data.
- Keyakinan temuan: confirmed / likely / unverified.

### Output
- Daftar temuan terurut.
- Gap analysis.
- Constraint signal.
- Kandidat vertical slice untuk diperbaiki.

### Gate 2
Pengguna menyetujui masalah yang dipilih dan batas scope sebelum solusi dirancang.

## Fase 3 — Solusi, acceptance criteria, trade-offs

### Tugas
- Tentukan hasil yang ingin dicapai untuk masalah terpilih.
- Tulis acceptance criteria untuk happy path, edge cases, dan failure paths sebelum coding.
- Bandingkan minimal 2–3 opsi: dampak, biaya, maintainability, failure modes, contextual fit, dan kemudahan rollback.
- Tentukan apakah perubahan database diperlukan.
- Definisikan API contract dan perilaku frontend yang diharapkan.
- Rencanakan automated tests dan seeded fault test.
- Tetapkan hal yang sengaja tidak dikerjakan.

### Output
- Solution brief.
- Tabel opsi/trade-offs.
- Acceptance criteria yang dapat diuji.
- Rencana implementasi dan test matrix.

### Gate 3
Minta persetujuan eksplisit terhadap opsi dan acceptance criteria sebelum coding.

## Fase 4 — Implementasi vertical slice

### Prinsip
- Perubahan kecil, mudah ditinjau, dan terkait langsung dengan masalah.
- Backend dan frontend wajib tercakup.
- Data model/migration hanya jika diperlukan.
- Ikuti konvensi repository.
- Jangan menonaktifkan atau melemahkan tes untuk membuat build lulus.
- Jangan melakukan refactor tidak terkait.
- Gunakan data sintetis.

### Urutan yang disarankan
1. Tambahkan atau perbaiki test yang mendeskripsikan perilaku yang diharapkan.
2. Pastikan test gagal karena alasan yang benar sebelum implementasi, bila workflow test memungkinkan.
3. Implementasikan aturan domain/backend dan validasi.
4. Perbarui model/migration bila benar-benar diperlukan; pastikan aman terhadap data lama dan reversible.
5. Implementasikan frontend serta state loading/empty/error/partial/success yang relevan.
6. Jalankan test backend dan test frontend yang tersedia.
7. Periksa lint/typecheck/build bila tersedia.
8. Uji secara manual pada alur utama dan failure paths.
9. Review diff untuk secret, data pribadi, perubahan tidak relevan, dan kualitas kode.

### Gate 4
Laporkan perubahan, perintah yang dijalankan, hasil tes aktual, dan keterbatasan. Minta persetujuan sebelum finalisasi PR dan laporan.

## Fase 5 — Seeded fault test dan AI verification

### Seeded fault test
- Buat eksperimen terisolasi di scratch branch atau metode yang aman.
- Ubah sementara logika yang seharusnya dilindungi tes.
- Jalankan test terkait dan simpan bukti bahwa tes gagal.
- Revert perubahan eksperimen dan pastikan working tree kembali bersih.
- Jangan pernah memasukkan fault yang sengaja dibuat ke PR final.
- Simpan commit/history atau bukti sesuai kebutuhan agar proses dapat ditinjau.

### AI verification moment
Catat satu contoh saran/kode AI yang salah atau berisiko:
- Apa saran tersebut.
- Mengapa berisiko.
- Cara memverifikasi (test, dokumentasi, tracing, eksperimen lokal).
- Koreksi yang dibuat.
- Bukti hasil verifikasi.

Jangan mengarang contoh. Gunakan kejadian nyata selama pengerjaan.

### Gate 5
Pastikan bukti dapat direproduksi dan perubahan eksperimen sudah dibatalkan.

## Fase 6 — PR dan submission package

### Pull Request
- Judul menyebut masalah dan manfaat.
- Deskripsi berisi konteks, solusi, trade-offs, acceptance criteria, cara pengujian, screenshot, risiko, dan keterbatasan.
- Sertakan link isu/PR terkait jika ada.
- Jangan merge kecuali diminta.

### PDF report
Susunan yang disarankan:
1. Executive summary.
2. Product/domain context dan pengguna.
3. Workflow yang diuji.
4. Temuan P0–P3 dan constraint signal.
5. Masalah terpilih dan gap ke kondisi ideal.
6. Opsi solusi dan trade-offs.
7. Acceptance criteria dan edge cases.
8. Implementasi arsitektur/data flow.
9. Bukti pengujian dan seeded fault test.
10. AI verification moment.
11. Screenshot sebelum/sesudah dan state penting.
12. Link PR dan video.
13. Keterbatasan, asumsi, dan langkah lanjutan.

### Video 3–5 menit
- Konteks masalah (30–45 detik).
- Workflow dan masalah (30–45 detik).
- Solusi yang dibuat (1–2 menit).
- Edge case dan bukti tes (45–60 detik).
- Trade-off dan penutup (20–30 detik).

### Final checklist
- [ ] PDF tunggal.
- [ ] PR terbuka dan dapat diakses reviewer.
- [ ] Narasi langkah 2–5 lengkap.
- [ ] Screenshot relevan dan bebas data nyata.
- [ ] Video berdurasi 3–5 menit.
- [ ] Tes, seeded fault test, dan AI verification didukung bukti.
- [ ] Tidak ada secret, key, atau personal data di commit.
- [ ] Kandidat mampu menjelaskan seluruh perubahan.
