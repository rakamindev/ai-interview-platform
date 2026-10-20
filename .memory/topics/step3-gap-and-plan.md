# Step 3–5: Masalah inti, temuan P0–P3, rencana revamp

> Dibangun 2026-10-20 dari runtime: assessment 4 "Backend Engineer (gap test)" (3 skill), session 9 (kandidat fiktif "Kandidat Uji", hanya membahas 1 skill, diakhiri lebih awal), vacancy 2, portfolio 6, fit/gap report 3. Data uji ini sengaja dibiarkan untuk dilihat user; report 3 tercemar override probe lintas-tenant (sudah dihapus) → regenerate atau hapus sebelum demo.
> Status: rencana menunggu konfirmasi user (lihat decisions.md).

## Masalah inti
Produk mengubah **ketiadaan bukti menjadi vonis negatif**, dan koreksi manusia tidak bertahan. Skill yang tidak pernah ditanyakan disimpan `ai_level=1` (DB: `NOT NULL CHECK 1..5`), tampil "L1 Foundational", dihitung "Gap" di fit/gap, lalu narasi LLM menyimpulkan "not recommended". Override assessor terhapus diam-diam saat regenerasi, report fit/gap basi tanpa penanda, dan endpoint portfolio bisa dibaca/ditulis lintas tenant. Hasil tidak bisa dipertanggungjawabkan → assessor/HM tidak bisa memercayainya, kandidat dirugikan oleh hal yang tidak pernah ditanyakan.

## Temuan (✅ terverifikasi runtime, 🔍 dari kode)
| P | Temuan | Jenis | Layanan | Bukti |
|---|---|---|---|---|
| P0 | Skill tak dinilai → L1 → "Gap" → narasi "not recommended" | missing spec (PRD tak definisikan) + defective (path `not_assessed` di engine tak pernah tercapai) | api+web | ✅ session 9: summary "not evaluated" tapi `ai_level=1`; fit/gap delta −3/−2; screenshot portfolio & fit/gap |
| P0 | IDOR lintas tenant: fit/gap & export (kutipan kandidat) terbaca, override bisa ditulis | defective | api | ✅ org probe: 200/200/201 |
| P0 | Override assessor hilang saat portfolio diregenerasi (`destroy_all` cascade); job N10 duplikat (6+ run/sesi) | defective | api | ✅ override 1 → 0 |
| P1 | Jawaban kandidat hilang saat Gemini reconnect di tengah jawaban (±30 s tak masuk transkrip); tidak ada penanda | defective | api realtime | ✅ session 9: 3 turn |
| P1 | Report fit/gap basi: tetap memakai override yang sudah tiada (L5 "Exceeds"), narasi memuji skill tak dinilai | defective | api+web | ✅ screenshot |
| P1 | Seam: kolom Required kosong (`expected_level` vs `required_level`); ✏ override tak pernah tampil (`is_override` tak dikirim walau engine menghitung `overridden`) | defective | api↔web | ✅ payload + screenshot |
| P1 | UI portfolio: badge "L1 Foundational" + banner "Only briefly explored" untuk skill "not evaluated"; tak ada info sesi berakhir dini | defective presentation | web | ✅ screenshot |
| P1 | Kegagalan model senyap: FLASH 404 → coverage beku tanpa notifikasi; PRO 503/timeout; status bolak-balik failed/generating | missing spec (UX gagal) + defective | api+web | ✅ log |
| P1 | Kandidat: layar ✅ "Interview Complete — recorded" saat error fatal; tanpa notice/consent/hak PDP; UI Inggris saja | missing spec | web | ✅ / 🔍 |
| P1 | Password plaintext di log (tanpa `filter_parameters`) | defective | api | ✅ |
| P2 | Confidence tak stabil antar-run (level sama, `medium`→`low`); confidence AI tetap tampil setelah override | missing spec | api | ✅ |
| P2 | Transkripsi salah dengar ("wet hook") masuk sebagai bukti; kutipan tak diverifikasi ke transkrip | missing spec | api | ✅ / 🔍 |
| P2 | Ambang speed test 8/4 Mbps menolak koneksi seluler umum Indonesia | missing spec | web | 🔍 |
| P3 | Default model di kode/sample usang (`gemini-2.0-*`); DX: Puma cluster crash macOS (sudah diperbaiki), tanpa test/CI | defective | api | ✅ |

## Constraint signal (eskalasi ke TL)
- Model data tak bisa menyatakan "tidak dinilai" (`ai_level NOT NULL CHECK 1..5`) → butuh migrasi di DB yang dipakai bersama `rakamin-api` (schema `ai_interview`); harus reversible & aman untuk baris lama.
- Isolasi tenant hanya di 3 model; tabel `organizations` milik `rakamin-api` (read-only reference).
- UU PDP: siapa pengendali vs prosesor, dasar pemrosesan & notice kandidat, retensi, transfer ke Google — belum ada pemilik keputusan.
- Ketergantungan model Gemini: nama berubah/404, 503 sering, latensi PRO tak terduga; tak ada pinning/abstraksi.
- Realtime: audio hilang saat reconnect; akar masalah belum diketahui.
- Nol test/CI: harness RSpec + Vitest harus dibangun dulu.
- Ambiguitas: bolehkah hasil AI jadi satu-satunya dasar penolakan? PRD diam.

## Rencana revamp (usulan): "Hasil yang bisa dipertanggungjawabkan"
- Opsi A (dipilih): status penilaian eksplisit di model data (`assessment_status`: assessed / insufficient_evidence / not_assessed, `ai_level` nullable) + aturan deterministik dari coverage & bukti mengalahkan klaim LLM + validasi output LLM + verifikasi kutipan ke transkrip + override dipertahankan + job idempoten + report fit/gap dengan penanda basi + scoping tenant + revamp layar Portfolio & Fit/Gap.
- Opsi B: patch presentasi saja (inferensi "tidak dinilai" di serializer/UI) — murah, tanpa migrasi, tapi DB/export/ATS tetap bohong, heuristik rapuh.
- Opsi C: perbaiki prompt saja (LLM mengembalikan null) — termurah, bergantung kepatuhan LLM yang terbukti tak stabil; tetap butuh migrasi.
- Di luar scope (didokumentasikan): akar masalah audio hilang saat reconnect (mitigasi: tandai sesi), alur consent kandidat, ambang speed test, Bahasa Indonesia.
