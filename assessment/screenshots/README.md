# Screenshots — Panduan Bukti Visual

Aturan yang sama dengan dokumen lain: **screenshot harus diambil dari output yang benar-
benar dijalankan olehmu**, bukan digambar atau dikarang. Status di bawah ini jujur
mengenai apa yang sudah bisa diambil sekarang dan apa yang masih menunggu prasyarat.

**Konvensi nama file:** `NN-nama-singkat.png`, NN mengikuti nomor urut di bawah.
Simpan di folder ini, lalu referensi-nya masuk ke PDF.

## A. Bisa diambil SEKARANG (semua = re-run perintah di terminal, lalu tangkap output)

| File | Isi | Cara ambil |
|---|---|---|
| `01-test-hijau-final.png` | Suite hijau: `Test Files 9 passed (9)` / `Tests 46 passed (46)` | `npm test` di `web/` — output lengkap ada di 05 §1 |
| `02-seeded-fault-merah.png` | Fase MERAH: `Test Files 3 failed \| 6 passed (9)` / `Tests 4 failed \| 42 passed (46)`, exit 1 | Ulangi siklus 05 §4a: ubah 1 baris `toConfidenceLabel` default → `return "LOW"`, jalankan `npm test`, **tangkap layar**, lalu kembalikan |
| `03-seeded-fault-hijau-lagi.png` | Setelah dikembalikan: hijau 9/46 lagi | Lanjutkan siklus di atas — 3 fase ini harus terlihat berurutan di PDF |
| `04-build-bukti.png` | `npm run build`: 1844 modul, 4 chunk, 579 kB / gzip 186 kB | `npm run build` di `web/` |
| `05-lint-tsc-bukti.png` | `tsc --noEmit` exit 0 + `npm run lint` 0 errors / 17 warnings | Jalankan keduanya, satu tangkapan layar |

> Catatan penting untuk `02`: siklus seeded fault FE **sudah dijalankan satu kali
> penuh** dan output aslinya terekam di 05 §4a — tapi screenshot-nya tetap harus
> kamu ambil sendiri saat re-run, karena yang dinilai adalah *kamu* yang mengulang
> dan memahaminya (ini juga aksi #2 di bagian [PERLU SUARAMU] 05).

## B. Membutuhkan backend hidup (API + PostgreSQL + Redis) — belum bisa diambil

| File | Isi | Prasyarat |
|---|---|---|
| `06-ui-confidence-sebelum-sesudah.png` | Sebelum: `medium` tampil "confirmed" / nilai hilang tampil LOW → Sesudah: label benar + fallback "not available" | Backend hidup + data portfolio dengan confidence `medium`, kosong, dan `high` |
| `07-ui-level-unknown.png` | Nilai level di luar 1..5 → badge kotak putus-putus "Unknown", radio tidak terisi angka karangan | Backend hidup + data `ai_level` rusak (atau mock lokal) |
| `08-ui-interview-error.png` | B1: fetch gagal → layar error "tanya ulang server" (bukan "Interview Complete") | Sebenarnya **mungkin** bisa diambil tanpa data: jalankan frontend tanpa backend → layar error yang baru |
| `09-ui-levele-dia-scope.png` | E1: klik label di skill ke-2 tidak lagi mengubah skill ke-1 (before: berubah) | Backend hidup + 2+ skill di form vacancy |

## C. Membutuhkan repo di-push ke GitHub — belum bisa diambil

| File | Isi | Prasyarat |
|---|---|---|
| `10-ci-hijau.png` | Run GitHub Actions hijau: 4 step (typecheck → lint → test → build) | Push branch ke GitHub; workflow sudah ada di `.github/workflows/ci.yml` (job `api` masih ter-komentar) |

## D. Membutuhkan Ruby 3.3.2 + spec — belum bisa diambil

| File | Isi | Prasyarat |
|---|---|---|
| `11-be-seeded-fault-hijau.png` | Fase 1: spec `StateEngine` hijau sebelum fault | Ruby terpasang, `spec/` di-bootstrap (05 §4b step 1) |
| `12-be-seeded-fault-merah.png` | Fase 2: kembalikan loop `resolve_state` asli → merah | 05 §4b step 2 — commit fault, jangan ditinggal di branch final |
| `13-be-seeded-fault-hijau-lagi.png` | Fase 3: perbaikan + spec hijau | 05 §4b step 3 |

## Urutan pengambilan yang disarankan

1. **Kini:** A (5 tangkapan) — ±20 menit, semua perintah sudah ada di 05.
2. **Setelah push:** C.
3. **Setelah Ruby:** D (3 tangkapan untuk siklus seeded fault backend).
4. **Setelah backend hidup:** B.

Total target: **13 screenshot**. Yang wajib minimal masuk PDF: `01`, `02`, `03`
(siklus seeded fault FE — bukti Proven Correctness), `04`, dan satu dari B atau D
(saat tersedia).

> **[PERLU SUARAMU:** seluruh screenshot di atas diambil olehmu. Saat defense,
> kamu harus bisa menunjuk ke layar MERAH (`02`/`12`) dan menjelaskan *test mana*
> yang merah dan *kenapa* — daftar 4 test merah FE ada di 05 §4a.]
