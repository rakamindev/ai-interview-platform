# Setup dan baseline eksplorasi

Status: dokumentasi awal, diperbarui 27 Oktober 2026. Catatan ini merangkum output terminal, screenshot, dan percobaan pengguna selama eksplorasi. Ini bukan bukti bahwa seluruh alur produk atau seluruh tes sudah lulus.

## 1. Repository dan baseline

| Item | Nilai |
| --- | --- |
| Repository asal | https://github.com/rakamindev/ai-interview-platform |
| Fork pengerjaan | https://github.com/loma09/ai-interview-platform |
| Direktori lokal | `D:\ai-interview-platform` |
| Branch saat dokumentasi diperiksa | `loma/project-setup` |
| HEAD saat pemeriksaan | `b836d02f45c6300b238b98ad50e66ead706723b6` |
| Struktur | `api/` untuk Rails; `web/` untuk React |
| Dokumen assessment | `assessment/` di root repository |

HEAD di atas adalah titik yang dibaca saat dokumentasi disusun, bukan klaim bahwa semua perubahan setup sudah di-commit. Working tree memiliki perubahan pada Dockerfile, Gemfile, lockfile, `.dockerignore`, dan dokumentasi. Commit awal sebelum eksplorasi belum dicatat terpisah.

## 2. Lingkungan yang dilaporkan

| Komponen | Versi/kondisi |
| --- | --- |
| OS/shell | Windows, PowerShell |
| Ruby native awal | 3.3.2, `x64-mingw-ucrt` |
| Bundler native | 4.0.23 |
| Node.js | v24.21.0 |
| npm | 12.2.1 |
| Docker Desktop | 4.69.0; Docker Engine 29.4.0 |
| Rails | 7.0.10 dari output startup |
| Puma | 5.6.9 dari output startup Windows |
| Sidekiq | 7.3.10 dari output startup |
| Vite | 6.4.5 dari output startup |
| PostgreSQL | Container `postgres:16` |
| Redis | Container `redis:alpine` |

Versi runtime Linux dan image digest final belum diarsipkan. Tag `redis:alpine` dapat berubah; rekam digest untuk reproduksi final.

## 3. Topologi lokal yang dipakai

| Layanan | Cara menjalankan | Akses dari Windows | Alamat dari container aplikasi |
| --- | --- | --- | --- |
| Frontend | Vite di Windows | `http://localhost:5173` | Tidak diperlukan untuk koneksi database |
| API | Container `ai-interview-api` | `http://localhost:3001` | Port internal 3001 |
| Worker | Container `ai-interview-sidekiq` | Tidak mempublikasikan port HTTP | Menggunakan database dan Redis yang sama dengan API |
| PostgreSQL | Container `ai-interview-postgres` | `127.0.0.1:5433` | `ai-interview-postgres:5432` |
| Redis | Container `ai-interview-redis` | `127.0.0.1:6380` | `ai-interview-redis:6379` |

API, Sidekiq, PostgreSQL, dan Redis disambungkan ke jaringan Docker `ai-interview-local`. Username/password database serta API key tetap dikelola di file lokal pengguna; nilainya tidak dimasukkan ke laporan.

## 4. Perjalanan setup dan hasilnya

1. Dependensi API dipasang dengan `bundle install`: berhasil, 30 dependensi Gemfile dan 125 gems pada output awal.
2. Rails Windows gagal boot karena data zona waktu tidak tersedia. Dependensi `tzinfo-data` ditambahkan untuk Windows/JRuby. Perintah pengecekan `TZInfo::Timezone.get('Asia/Jakarta').identifier` menghasilkan `Asia/Jakarta`.
3. Redis port 6379 bentrok dengan layanan lain. Container project memakai port host 6380. `docker exec ai-interview-redis redis-cli ping` menghasilkan `PONG`.
4. PostgreSQL berada di port host 5433. Koneksi awal gagal karena password tidak dikirim. Setelah konfigurasi lokal diperbaiki, database `rakamin_development` dan `rakamin_test` berhasil dibuat, migrasi selesai, dan seed membuat organisasi pengujian serta 22 skill taxonomy.
5. Puma Windows gagal karena default dua worker memerlukan dukungan platform yang tidak tersedia. `WEB_CONCURRENCY=0` memungkinkan startup single process, tetapi belum menyelesaikan kendala TLS.
6. Frontend berhasil startup. URL REST yang awalnya menunjuk port 3000 dikoreksi ke port 3001 dengan suffix `/api/v1`; URL WebSocket menggunakan port 3001 tanpa suffix tersebut.
7. Login lokal memakai akun admin pengujian yang dibuat pengguna melalui Rails console. Keberhasilan JWT manual di Postman tidak otomatis membuat akun login.
8. Undangan awal membuka `/interview/...` di port API dan mendapat routing error. Dari `Session#invite_url`, `APP_BASE_URL` ternyata menjadi basis link frontend. Nilai lokal dikoreksi ke `http://localhost:5173`.
9. Saat memulai audio di Windows, proses Ruby berhenti dengan `Encryption not available on this event-machine`. Pemeriksaan `EventMachine.ssl?` menghasilkan `false`.
10. Dockerfile yang ada disesuaikan untuk development: dependensi development/test tidak lagi dikecualikan, dan `libssl-dev` ditambahkan pada tahap builder. `.dockerignore` mengecualikan konfigurasi secret serta artefak lokal. Image `ai-interview-api:local` berhasil dibangun; pemeriksaan EventMachine di image menghasilkan `TLS OK`.
11. Rails dan Sidekiq dipindahkan ke container Linux. Konfigurasi lokal dipasang read-only saat runtime; alamat PostgreSQL dan Redis di-override dengan nama container. Container lama database tetap dipakai tanpa mengulang seed.
12. Gemini menolak model Live `gemini-2.0-flash-live-001` dengan kode 1008. Log menunjukkan tiga retry, kemudian sesi berakhir dengan alasan `error`. Setelah konfigurasi model diperbarui, pengguna berhasil berinteraksi dengan AI dan memperoleh transcript pada satu percobaan. Stabilitas lintas sesi belum terbukti.
13. Job portfolio mendapat respons Gemini 400/404. Nilai konfigurasi yang dilaporkan masih `gemini-2.0-pro-001` dan `gemini-2.0-flash-001`. Model pengganti disarankan, tetapi keberhasilan regenerasi portfolio setelah perubahan belum dilaporkan.

## 5. Konfigurasi non-secret

Frontend memerlukan pengaturan berikut:

```dotenv
VITE_API_BASE_URL=http://localhost:3001/api/v1
VITE_WS_BASE_URL=ws://localhost:3001
```

`VITE_DEV_TOKEN`, jika digunakan, dikelola sendiri secara lokal dan tidak disertakan dalam dokumen. `VITE_DEV_TENANT_ID` dan `VITE_DEV_TENANT_NAME` menyediakan konteks tampilan frontend; otorisasi backend tetap bergantung pada mekanisme autentikasi dan tenant backend.

Untuk eksplorasi terbatas, endpoint ping dan upload dialihkan ke API lokal:

```dotenv
VITE_SPEED_TEST_PING_URL=http://localhost:3001/api/v1/health
VITE_SPEED_TEST_UPLOAD_URL=http://localhost:3001/api/v1/speed_test
```

**Batas pengujian:** pengukuran ping/upload tersebut hanya menguji browser ke komputer lokal. Hasil lulus tidak membuktikan kesiapan internet ke Gemini. Pengukuran download tetap memakai layanan eksternal. Konfigurasi ini adalah bantuan eksplorasi, bukan perbaikan kualitas pengukuran produk.

Nama model yang disarankan dalam eksplorasi:

| Fungsi | Nilai yang disarankan | Status bukti |
| --- | --- | --- |
| Live interview | `gemini-3.8-live` | Ada interaksi AI setelah perubahan konfigurasi; nilai efektif runtime belum dicatat terpisah |
| Coverage/Flash | `gemini-3.6-flash` | Saran konfigurasi; hasil coverage belum diverifikasi |
| Portfolio/Pro | `gemini-3.1-pro-preview` | Saran konfigurasi; regenerasi berhasil belum diverifikasi |

Ketersediaan model, hak akses, kuota, dan kompatibilitas payload perlu diuji menggunakan akun pengguna. Nama model tidak boleh menjadi jaminan keberhasilan API.

## 6. Menjalankan lingkungan yang sudah dibuat

Dengan container dan jaringan di atas sudah tersedia:

```powershell
docker start ai-interview-postgres ai-interview-redis
docker start ai-interview-api ai-interview-sidekiq
```

Di terminal frontend:

```powershell
cd D:\ai-interview-platform\web
npm.cmd run dev
```

Setelah konfigurasi backend lokal berubah:

```powershell
docker restart ai-interview-api ai-interview-sidekiq
```

Pemeriksaan dasar:

```powershell
Invoke-RestMethod http://localhost:3001/api/v1/health
docker exec ai-interview-redis redis-cli ping
docker run --rm ai-interview-api:local bundle exec ruby -reventmachine -e "abort('TLS unavailable') unless EventMachine.ssl?; puts 'TLS OK'"
```

Pemeriksaan TLS di atas tidak memuat Rails atau konfigurasi secret. Health endpoint mengembalikan status statis; respons 200 tidak membuktikan kesehatan database, antrean, atau Gemini. Koneksi database dibuktikan terpisah oleh request assessment/candidate yang berhasil.

Jangan menjalankan Rails Windows lagi bersamaan dengan API Docker: keduanya akan berebut port 3001. Perubahan kode API memerlukan rebuild image dan pembuatan ulang container pada konfigurasi saat ini karena source code belum dipasang sebagai bind mount. Restart saja cukup untuk file konfigurasi yang memang dipasang saat runtime.

## 7. Bukti smoke test

| Pemeriksaan | Hasil yang tersedia | Batas kesimpulan |
| --- | --- | --- |
| Health API | HTTP 200, `{"status":"ok"}` | API dapat diakses |
| Assessments tanpa token | HTTP 403, tenant tidak ditemukan | Request ditolak; belum membuktikan seluruh aturan autentikasi benar |
| Assessments dengan JWT admin lokal | HTTP 200, daftar awal kosong | Request ini berhasil pada konteks pengujian |
| Login frontend | Halaman assessment tampil setelah akun lokal dibuat dan URL API dikoreksi | Seluruh role/tenant belum diuji |
| Assessment dan undangan | Pengguna berhasil membuat assessment serta sesi kandidat | Validasi edge case belum diuji secara menyeluruh |
| Candidate info | HTTP 200 pada log API Docker | Informasi sesi dapat diambil |
| Redis/Sidekiq | `PONG`, log worker mulai memproses | Tidak menjamin semua job berhasil |
| AI/transcript | Ada percakapan dan transcript pada satu sesi | Kualitas dan stabilitas wawancara penuh belum terbukti |
| Portfolio | UI gagal; log job menunjukkan 400/404 | Belum ada bukti portfolio sukses |

## 8. Pekerjaan verifikasi yang masih terbuka

- Arsipkan versi Ruby Linux, image digest, dan perintah build final.
- Uji pemulihan portfolio setelah pembaruan model.
- Telusuri audio kandidat yang tidak muncul di transcript pada percobaan berikutnya.
- Uji alur coverage, portfolio, fit/gap, override, dan ekspor dengan bukti yang cukup.
- Hasil automated tests audio sudah tersedia pada `audio-fix.md` dan folder `evidence/`: 9 tes frontend, 3 spec backend, serta smoke test Web Audio sintetis lulus. Percakapan live setelah patch belum diverifikasi.
- Sanitasi token undangan, header autentikasi, isi transcript, dan nama kandidat sebelum screenshot/log dibagikan.

## Referensi

- [README repository](https://github.com/rakamindev/ai-interview-platform)
- [PRD 01: AI Interview Behavior](https://github.com/rakamindev/ai-interview-platform/wiki/PRD-01-%E2%80%94-First-Principles:-AI-Interview-Behavior)
- [PRD 02: End-to-End Interview](https://github.com/rakamindev/ai-interview-platform/wiki/PRD-02-%E2%80%94-Real-Simulation:-End%E2%80%90to%E2%80%90End-Interview)
- [Google: jadwal penghentian model](https://ai.google.dev/gemini-api/docs/deprecations)
- [EventMachine: laporan dukungan OpenSSL di Windows](https://github.com/eventmachine/eventmachine/issues/1011)
