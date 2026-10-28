# Indeks evidence untuk laporan

Pemeriksaan terakhir: 28 Oktober 2026. Hasil frontend paling baru E12/E13: 31 unit tests dan 16 skenario viewport Edge lulus. Backend terakhir E11: 18 contoh lulus; tidak diubah oleh slice Retry/mobile. E09 tetap snapshot 25/18 setelah patch reload/outcome. E01-E05 tetap snapshot sebelum patch; tidak diubah untuk memalsukan riwayat. File `audio-*-red/green.txt` merekam tahap investigasi yang berbeda dan tidak boleh dijumlahkan sebagai jumlah tes unik.

## Bukti final yang diprioritaskan

| ID | Yang dibuktikan | Hasil aktual | File |
| --- | --- | --- | --- |
| E01 | Suite frontend final | 14 tes, 4 file, lulus; exit 0 | [final-frontend.txt](final-frontend.txt) |
| E02 | Suite backend dalam image tanpa jaringan/secret mount | 8 contoh, 0 gagal; exit 0 | [final-backend.txt](final-backend.txt) |
| E03 | Web Audio nyata di Edge dengan input sintetis | PCM16 16 kHz, mute/unmute, playback/drain 24 kHz PASS; exit 0 | [final-browser.txt](final-browser.txt) |
| E04 | Pemeriksaan tipe dan build aplikasi | TypeScript exit 0; Vite exit 0, 1841 modul; envDir false | [final-build.txt](final-build.txt) |
| E05 | Snapshot kode/alat yang diperiksa | Branch, HEAD, dirty tree, image ID, versi alat dan SHA-256 file terpilih | [verification-manifest.json](verification-manifest.json) |
| E06 | Seeded fault dengan riwayat Git lokal | Baseline 8/0, fault 8/1, restore 8/0; assertion identik | [panduan](../seeded-fault.md), [baseline](seeded-fault-baseline.txt), [red](seeded-fault-red.txt), [green](seeded-fault-green.txt), [history](seeded-fault-history.txt), [manifest](seeded-fault-manifest.json) |

E05 adalah snapshot kode saat verifikasi, bukan commit perubahan yang sudah dipublikasikan. Image tag lokal dapat berubah; ID image direkam agar dapat dibedakan. Hash file tidak menggantikan version control atau prosedur build yang reproducible.

## Bukti uji manual lanjutan

**E07 - Fit/gap dan ekspor:** [fitgap-export-verification.md](fitgap-export-verification.md) merangkum laporan yang tampil serta PDF/JSON yang berhasil diunduh dan memuat hasil yang sesuai pada sesi 18. Ini bukti manual berbasis screenshot/isi file, terpisah dari tes otomatis. F10 (Required kosong di web), F11 (gap dari skill tanpa evidence), dan F12 (error lama tersisa) tetap terbuka.

**E08 - Error/recovery manual:** [manual-recovery-mobile.md](manual-recovery-mobile.md). Penolakan mic dan pemulihan Allow + reload dikonfirmasi berhasil; Retry precheck tetap gagal (F02). Force reconnect Gemini menghasilkan Reconnecting -> Connected dan AI kembali merespons. Percobaan Offline/Wi-Fi belum konklusif; mobile belum diuji.

**E09 - Perbaikan reload/resume dan outcome kandidat:** [reload-resume-fix.md](../reload-resume-fix.md), [frontend red](reload-frontend-red.txt), [backend red](reload-backend-red.txt), [checkpoint red](reload-checkpoint-red.txt), [unmount red](reload-unmount-red.txt), [frontend green 25](reload-frontend-green.txt), [backend green 18](reload-backend-green.txt), [typecheck](reload-typecheck.txt), [build](reload-build.txt), [UI browser](reload-ui-browser.txt), [audio browser](reload-audio-browser.txt), [manifest](reload-verification-manifest.json). Outcome UI diuji pada build sebenarnya dengan respons sintetis; sesi 23 akhirnya dapat dilanjutkan setelah intervensi, bukan bukti reload otomatis terisolasi. M03 lama tetap gagal pada baseline.

## Bukti fail-before-fix

| ID | Perilaku yang direproduksi | Sebelum | Sesudah pada tahap itu | Bukti |
| --- | --- | --- | --- | --- |
| R01 | Startup, capture graph, autoplay, dan cleanup | 8 gagal / 1 lulus | 9 lulus | [red](audio-frontend-red.txt), [green](audio-frontend-green.txt) |
| R02 | Akhir giliran model dan flush transkrip | 2 gagal / 1 lulus | 3 lulus | [red](audio-backend-red.txt), [green](audio-backend-green.txt) |
| R03 | Indikator aktivitas berdasarkan energi input | 3 gagal / 9 lulus | 12 lulus | [red](audio-indicator-red.txt), [green](audio-indicator-green.txt) |
| R04 | Jeda input, audioStreamEnd, dan watchdog jawaban panjang | 3 gagal / 3 lulus | 6 lulus | [red](audio-pause-red.txt), [green](audio-pause-green.txt) |
| R05 | Processor mempertahankan suara pelan dan seluruh jeda hening | 2 gagal / 12 lulus | 14 lulus | [red](audio-worklet-red.txt), [green](audio-worklet-green.txt) |
| R06 | Browser resume mendapat giliran kandidat | 1 gagal / 6 lulus | 7 lulus | [red](audio-resume-red.txt), [green](audio-resume-green.txt) |
| R07 | Permintaan REST model preview menuju endpoint v1beta | 1 gagal / 7 lulus | 8 lulus | [red](portfolio-endpoint-red.txt), [green](portfolio-endpoint-green.txt) |

Setiap baris adalah pengujian pada scope/tahap berbeda. Jangan mengatakan satu baseline berisi 14 tes jika baseline itu sebenarnya hanya memiliki 9 tes. Output red mencatat assertion failure yang relevan setelah masalah harness diperbaiki; tidak semua log historis merekam exit code shell secara eksplisit.

## Batas bukti dan klaim yang aman

- E01/E02 adalah tes otomatis dengan perangkat/transport sintetis. E03 memakai browser dan Web Audio nyata, tetapi tidak memakai mikrofon pengguna atau Gemini.
- Endpoint v1beta yang benar tidak membuktikan akun memiliki akses/kuota model atau bahwa hasil penilaian benar.
- Pengguna mengonfirmasi percakapan beberapa giliran dan portfolio tampil. Ini evidence live berbasis observasi pengguna; belum ada video terarsip yang dapat direview independen.
- Pemeriksaan metadata PostgreSQL sebelumnya menunjukkan sesi 18 complete dengan 3 skill. Query tersebut read-only; tidak mengambil isi transkrip. Ringkasan itu bukan file export database.
- Sesi 45 menit, ketahanan jaringan/reconnect live, browser lain, concurrency/duplicate jobs, dan UI mobile belum lulus hanya karena tes otomatis di sini lulus. Fit/gap dan ekspor kini memiliki verifikasi manual terpisah E07; edge cases serta QA layout menyeluruh masih terbuka.
- R01-R07 adalah fail-before-fix historis. Eksperimen seeded fault terpisah kini tersedia sebagai E06 pada branch lokal loma/seeded-fault-resume; [history di GitHub](https://github.com/loma09/ai-interview-platform/tree/loma/seeded-fault-resume) kini tersedia.
- Screenshot terminal opsional. Di PDF, tampilkan ringkasan evidence dan tautan repo/PR yang tepat setelah PR tersedia. Screenshot UI tetap perlu disiapkan terpisah.

## Cara menjalankan kembali

Dari direktori `web/`:

```powershell
npm.cmd test -- --reporter=verbose
npm.cmd run test:audio-browser
.\node_modules\.bin\tsc.cmd
node --input-type=module -e 'import { build } from "vite"; await build({ envDir: false });'
```

Dengan image project yang sudah dibangun dari source yang sama:

```powershell
docker run --rm --network none ai-interview-api:local bundle exec rspec --format documentation
```

Smoke script memerlukan Edge pada lingkungan Windows ini. Jangan menjalankan build Docker dengan konteks yang memasukkan secret; gunakan `.dockerignore` project. Tidak perlu menjalankan ulang seed database untuk tes offline ini.

## Pemeriksaan data sensitif

File evidence teks diperiksa untuk pola umum API key, JWT, private key, token invite pada URL, dan email. Tidak ditemukan kecocokan pada pemeriksaan ini. Ini pemeriksaan terbatas, bukan jaminan seluruh repository bebas data sensitif. Path lokal tooling muncul pada stack trace historis; path itu bukan kredensial dan harus dipertimbangkan saat publikasi. Review manual dan pemeriksaan seluruh staged diff tetap diperlukan sebelum commit/PR.

Isi mentah dipertahankan; kode warna ANSI dibersihkan bila ada. Tidak ada log request Gemini lengkap, rekaman mikrofon asli, key, atau konfigurasi runtime yang ditambahkan pada run final ini.

## Status artefak pengumpulan

- [PR #214](https://github.com/rakamindev/ai-interview-platform/pull/214) dan branch source sudah tersedia; video masih perlu dilengkapi.
- [Branch/commit seeded fault E06](https://github.com/loma09/ai-interview-platform/tree/loma/seeded-fault-resume) sudah dipublikasikan; ketiga commit tercantum pada PR.
- Video demo live; lima screenshot yang sudah disanitasi tersedia pada E10.
- Bukti failure paths/rilis yang belum tercakup, sesuai scope akhir.

Ringkasan siap pakai untuk laporan terdapat pada [../evidence-summary.md](../evidence-summary.md). Catatan investigasi lebih rinci terdapat pada [../audio-fix.md](../audio-fix.md).


## E10 - Screenshot live dari pengguna

Lima screenshot lama yang sudah disanitasi beserta konteks dan batas bukti: [live-screenshots/README.md](live-screenshots/README.md). Screenshot kondisi gagal tidak dinyatakan sebagai hasil sesudah perbaikan.


## E11 - Review sebelum commit (28 Oktober 2026)

- [Reproduksi End/reconnect](review-end-ack-red.txt): 1 gagal, 11 dilewati pada targeted regression sebelum perbaikan.
- [Frontend terbaru](review-frontend-green.txt): 26 tes lulus, exit 0.
- [Backend terbaru](review-backend-green.txt): 18 contoh, 0 gagal, exit 0; image yang sama dengan E09, network none, read-only, tanpa secret mount.
- [Tipe dan build](review-build.txt): typecheck dan build exit 0, envDir false.
- [Review dan batas pemeriksaan secret](../commit-review.md).

E01-E10 tidak diubah jumlah tesnya. Tidak ada pengujian live Gemini baru pada review ini.


## E12 - Retry hardware (28 Oktober 2026)

[Penjelasan dan cara uji](../hardware-retry-fix.md). [Red 5 gagal](hardware-retry-red.txt), [green 5 lulus](hardware-retry-green.txt), [suite 31 lulus](hardware-full-green.txt), [typecheck/build](hardware-build.txt). Perangkat dan jaringan pada unit tests sintetis; threshold tetap.


## E13 - Mobile dan teks panjang (28 Oktober 2026)

[Penjelasan dan cara uji](../mobile-check.md). [Before](mobile-before/results.json): 8 dari 16 gagal layout; [after](mobile-after/results.json): 16/16 lulus, [suite31](mobile-unit-green.txt), [build](mobile-build.txt). Empat layar x 360/390/768/1280 px. PNG di mobile-before/ dan mobile-after/ memakai data sintetis. Autoplay override dan scroll programatik membuat hasil ini tidak membuktikan izin, gesture, atau performa ponsel fisik.
