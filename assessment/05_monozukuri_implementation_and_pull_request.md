# Step 5: Monozukuri Implementation & Pull Request

Branch: `revamp/session-entry-and-fixes` (off `main`). Setiap commit menutup satu temuan spesifik dari [`03_defining_problem_and_gap_to_ideal_condition.md`](03_defining_problem_and_gap_to_ideal_condition.md), dengan pola yang sama di semuanya: **tulis test dulu → jalankan, pastikan gagal terhadap kode lama → baru terapkan fix → jalankan lagi, pastikan lolos.** Ini bukan klaim kosong — setiap commit di bawah punya jejak "gagal N kali, lolos setelah fix" yang saya saksikan sendiri sebelum commit.

> **Catatan hash commit**: history di-rewrite **dua kali** untuk menghilangkan nilai password dev di `docker-compose.yml` setelah check GitGuardian gagal. Hash di tabel ini adalah hash final yang ter-push setelah kedua rewrite.

## Ringkasan Commit

| Commit | Isi | Test |
|---|---|---|
| `30da578` | Bootstrap RSpec + Vitest + Docker dev setup | — (infra, belum ada test) |
| `44ca273` | **F1** — `invite_url` pakai `WEB_BASE_URL`, bukan `APP_BASE_URL` | 2 spec, gagal 2/2 sebelum fix |
| `3953dcf` | **F2** — state `invalid_link`/`connection_error` menggantikan `.catch(() => complete)` | 3 spec, gagal 2/3 sebelum fix |
| `5ba957f` | chore: `GEMINI_API_KEY` dipindah ke `.env` (gitignored), bukan hardcode di `docker-compose.yml` | — |
| `2b864d5` | **F3** — key `required_level` menggantikan `expected_level` di Fit/Gap | 3 spec, gagal 3/3 sebelum fix |
| `201419f` | **F4** — status `not_started` terpisah dari `generating` di Portfolio | 4 spec backend + 2 test frontend, gagal 1/4 & 1/2 sebelum fix |
| `02eb224` | **F5** — badge "Live" dikondisikan pada `session.status`, bukan cuma koneksi WebSocket | 2 test, gagal 1/2 sebelum fix |
| `e2d597f` | **F6** — `onError` disambungkan ke `useAudioCapture`, mic gagal tidak lagi diam-diam | 1 test tambahan, gagal sebelum fix |
| `d40c3e9` | docs: laporan assessment Step 1-5 | — |

**Total test suite saat ini: 9 RSpec (backend) + 8 Vitest (frontend) — semuanya lolos, nol regresi** (diverifikasi ulang di container Docker, bukan cuma di mesin lokal).

## Detail Verifikasi per Temuan

Setiap fix di atas tidak cuma lolos test — saya reproduksi manual dulu di browser/API sebelum menyentuh kode, lalu verifikasi lagi setelah fix:
- **F1**: `invite_url` di-generate lewat API, dibuktikan 404 sebelum fix, 200 setelah fix.
- **F2**: dua skenario direproduksi terpisah — token tidak valid (matikan token) dan koneksi gagal (matikan container `api` sesaat) — masing-masing menghasilkan layar yang berbeda dan benar setelah fix.
- **F3**: data JSON mentah di database dibaca langsung lewat `rails runner`, dibuktikan key `required_level` selalu `nil` sebelum fix.
- **F4**: sesi yang belum pernah interview dibuka di halaman Portfolio, dibuktikan pesan "AI is analyzing..." palsu sebelum fix.
- **F5**: Live Monitor dibuka untuk sesi `pending`, dibuktikan badge "Live" tampil kontradiktif dengan teks "Waiting for interview to begin..." sebelum fix.
- **F6**: diverifikasi lewat test dengan `getUserMedia` di-mock gagal setelah hardware check lolos (skenario yang tidak mungkin diuji manual dengan mic asli, karena butuh mic dicabut tepat di tengah proses).

## Claimed Engineering Depth

Pekerjaan ini **seimbang antara backend dan frontend**, bukan berat sebelah:
- **Backend** (Rails): F1, F3, F4 + RSpec harness dari nol + `docker-compose.yml`/`Dockerfile.dev`.
- **Frontend** (React): F2, F5, F6 + Vitest harness dari nol + state machine `InterviewPage`.

Tidak ada sisi yang "sekadar disentuh" — kedua P0 (F1+F2) butuh perubahan di kedua layanan sekaligus karena satu masalah yang sama (link undangan) menembus API dan SPA.

## AI Verification Moment

Brief meminta minimal satu momen ketika kode atau tindakan dari AI salah atau berisiko, dan bagaimana saya memverifikasi serta mengoreksinya. Momen yang saya pilih adalah API key yang tercetak ke percakapan dengan AI.

**Yang terjadi.** Saya memakai key Gemini sementara yang khusus disiapkan untuk case study ini. Key itu sempat saya taruh di `docker-compose.yml`, lalu dipindah ke `.env` yang di-gitignore sebelum ada commit, setelah AI mengingatkan bahwa file tersebut di-track git. Beberapa menit kemudian, AI menjalankan `docker compose config` yang mencetak key utuh ke percakapan. Percobaan berikutnya dihentikan oleh pengaman otomatis di tool.

**Verifikasi.** Dengan bantuan AI, saya memindai seluruh object git lokal dan memastikan commit pada ref di remote fork saya ikut terperiksa. Key tersebut tidak ditemukan.

**Tindakan.** Karena key sempat tampil di percakapan, saya memperlakukannya sebagai key yang terekspos. Saya mencabut key tersebut di AI Studio setelah selesai mengerjakan case study. Saat menindaklanjuti feedback reviewer, saya mengecek kembali dan memastikan key itu sudah tidak ada.

**Refleksi.** Output perintah yang dijalankan AI juga bisa membocorkan secret, bukan hanya file yang di-commit. Oleh karena itu, sekarang saya menyimpan secret hanya di `.env`, memeriksa perintah yang bisa menampilkan konfigurasi sebelum dijalankan, dan memverifikasi key tanpa menampilkan nilainya, misalnya hanya lewat beberapa karakter pertama.

## Seeded Fault Test

**Selesai.** Dikerjakan di branch terpisah `scratch/seeded-fault-test` (ter-push ke `https://github.com/mhumam/ai-interview-platform/tree/scratch/seeded-fault-test`, tidak di-merge ke branch kerja utama):

1. **Rusak** ([`bb73929`](https://github.com/mhumam/ai-interview-platform/commit/bb73929)): `Session#invite_url` dikembalikan ke perilaku sebelum fix F1 (pakai `APP_BASE_URL` lagi).
2. **Jalankan test** → `spec/models/session_spec.rb`: **2 examples, 2 failures**. Full suite: **9 examples, 2 failures** — persis dan hanya kedua spec F1 yang gagal, membuktikan test-nya presisi (tidak ada efek samping ke spec lain).
3. **Revert** ([`6cf1688`](https://github.com/mhumam/ai-interview-platform/commit/6cf1688), `git revert bb73929`): kode kembali ke fix F1 yang benar.
4. **Verifikasi ulang** → full suite: **9 examples, 0 failures**.

Tidak dibuka sebagai Pull Request terpisah — brief hanya meminta "history visible" (branch ter-push cukup), dan karena hasil akhir rusak→revert ini net-zero perubahan kode, membuka PR untuknya justru tidak bermakna (GitHub akan menampilkan "no changes to merge"). Link commit di atas sudah cukup untuk reviewer memverifikasi tanpa perlu clone branch-nya.

History dua commit ini (rusak → revert) tetap terlihat di branch scratch sebagai bukti, tidak di-squash atau disembunyikan.

## Pull Request

**[PR #140](https://github.com/rakamindev/ai-interview-platform/pull/140)** — dibuka dari `mhumam:revamp/session-entry-and-fixes` ke `rakamindev/ai-interview-platform:main` (Option A dari brief: satu PR komprehensif, konsisten dengan keputusan scope di [`04_revamp_strategy.md`](04_revamp_strategy.md)). Deskripsi PR mencakup ringkasan severity, tabel bukti test per commit, catatan keamanan data, dan gap yang diketahui (AC7, keterbatasan repro F6).

**Status check**: `GitGuardian Security Checks` — **SUCCESS**. Status merge tersisa `REVIEW_REQUIRED` — menunggu review manusia dari tim `rakamindev`, bukan blocker teknis.
