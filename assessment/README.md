# Assessment — Integritas Penilaian

Case study Rakamin · posisi Front-end Intern · tema yang dipilih: **"Integritas Penilaian"**.

> **Satu kalimat masalah:** platform ini bisa menghasilkan penilaian keliru terhadap
> kandidat — dan ketika keliru, tidak ada satu pun sinyal yang muncul ke permukaan.
> Bug-nya menyeberang dari mesin perhitungan di backend sampai cara angka itu disajikan
> di frontend.

## Kenapa tema ini

- **Memenuhi Step 4 secara harfiah** — menyentuh `api/` **dan** `web/` di satu jahitan
  yang sama (perhitungan → penyajian), bukan dua perbaikan terpisah yang ditempel.
- **Menghantam pilar brief "People Affected Who Never Chose It"** — kandidat tidak memilih
  memakai produk ini, tapi hidupnya dipengaruhi hasilnya.
- **Bisa dites murah** — `StateEngine` pure class, `ConfidenceIndicator` pure function;
  deterministik, tidak butuh Gemini API.
- **Sempurna untuk Seeded Fault Test** — bug-nya bisa disuntik ulang dengan mengubah satu baris.

## Status per perbaikan (yang boleh diklaim vs belum)

| # | Perbaikan | Sisi | Status |
|---|---|---|---|
| 1 | Loop transisi tidak memakai `probe_count` sama berulang | BE | ✅ hijau + seeded fault MERAH→HIJAU |
| 2 | Auto-advance tidak mengarang `covered` / tidak menimpa `last_signal` | BE | ✅ hijau (log terstruktur, tanpa tulisan) |
| 3 | `level` hilang ≠ L1 — ditolak / ditandai unknown | BE+FE | ✅ hijau (LevelParser, migrasi nullable reversibel, jahitan FE `number \| null`) |
| 4 | Confidence unknown ≠ LOW; `medium` ≠ "confirmed" | FE | ✅ hijau 5/5 |
| 5 | `parseLevel` gagal ≠ 1 | FE | ✅ hijau 8/8 |
| 6 | `ai_level` konsisten (`string` → `number`) | FE | ✅ `tsc` bersih |
| 7 | Error interview ≠ "Complete" (B1 **dan** B2) | FE | ✅ hijau 5/5 (bukti MERAH→HIJAU) |
| 8 | `LevelRadio` id di-scope + `aria-label` | FE | ✅ hijau 4/4 + 5/5 |
| 9 | Harness: Vitest, ESLint, Prettier, RSpec, GitHub Actions | Both | ✅ FE 9 file / 47 test · BE 43 examples · CI 2 job (menunggu push pertama untuk hijau) |

**Bukti yang sudah dijalankan (bukan rencana):** suite frontend **9 file / 47 test hijau**,
`tsc --noEmit` bersih, `npm run lint` exit 0 (0 errors, 17 warnings), `npm run build` bersih
(1844 modul, 579 kB JS / gzip 186 kB). Suite backend **43 RSpec examples, 0 failures**
(Ruby 3.3.2 + Postgres 16 + Redis 7 di Docker — `api/Dockerfile.dev`). Seeded fault
dua sisi dengan bukti MERAH→HIJAU (FE: 1 baris + re-run; BE: commit fault `52be6c3` +
revert `20a47b0` di history). Migrasi `ai_level` nullable terbukti reversibel
(`db:rollback STEP=1` → `db:migrate`).

## Navigasi

| File | Isi |
|---|---|
| [`01-domain-understanding.md`](./01-domain-understanding.md) | Alur produk, istilah, dan kenapa salah-rating itu berbahaya |
| [`02-findings-p0-p3.md`](./02-findings-p0-p3.md) | Tabel temuan + bukti `file:line`, dikelompokkan klaster |
| [`03-options-tradeoffs.md`](./03-options-tradeoffs.md) | 2–3 opsi + trade-off per temuan besar, dan pilihannya |
| [`04-implementation.md`](./04-implementation.md) | Apa yang dikerjakan + kenapa, per perbaikan |
| [`05-testing.md`](./05-testing.md) | Harness, Seeded Fault, **AI Verification Moment**, No Regression |
| [`06-not-done-and-why.md`](./06-not-done-and-why.md) | Yang tidak dikerjakan dan alasannya |
| [`/screenshots`](./screenshots) | Bukti visual: sebelum/sesudah, test hijau/merah, CI |

## Transparansi tentang peran AI

Kerja ini dikerjakan **dengan AI sebagai partner implementasi**. Brief mengantisipasi ini —
buktinya ada standar **AI Verification Moment**. Aturannya yang kupatuhi: **setiap klaim
dari AI (termasuk analisis di dokumen ini) kubaca ulang ke file sumbernya sendiri sebelum
dimasukkan ke laporan.** Ada dua momen nyata di mana verifikasi itu mengubah kesimpulan —
tercatat apa adanya di [`05-testing.md`](./05-testing.md), bukan dikarang.

Prinsip yang sama dipakai untuk klaim: **jangan klaim apa pun yang tidak dijalankan.**
Kolom "belum dijalankan" di [`05-testing.md`](./05-testing.md) disengaja dibiarkan kosong,
bukan karena malas — itu disqualifier nomor 6 (klaim palsu) yang kublok dari awal.
