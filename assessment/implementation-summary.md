# Ringkasan Perubahan

Tanggal: 20 Oktober 2026

## Tujuan

Memperbaiki isolasi data tenant, validasi autentikasi, umpan balik login, serta konsistensi konfigurasi dan dokumentasi agar aplikasi lebih aman dan mudah dijalankan.

## Perubahan Backend

- Tenant-scoped model kini fail-closed: tanpa konteks tenant, query tidak membaca record tenant mana pun.
- Tenant ID diteruskan ke worker system prompt, portfolio, fit/gap, dan coverage. Job tanpa tenant dilewati, bukan diproses tanpa batas tenant.
- Lookup portfolio dan portfolio skill dibatasi melalui relasi session yang sudah berada dalam tenant aktif.
- Authorization hanya menerima header Bearer dan menolak JWT tanpa `user_id`, `role`, atau `scheme`.
- Role otorisasi dibaca dari claim JWT yang tanda tangannya sudah diverifikasi. Lookup ke tabel user lokal tidak digunakan karena database proyek tidak memiliki tabel user bersama di schema `public`, sementara token berasal dari layanan Rakamin.
- Penghapusan kandidat memakai endpoint `DELETE /api/v1/sessions/:id` dan menghapus transcript, coverage, portfolio, serta hasil terkait. Penghapusan assessment menghapus session turunannya.
- Penghapusan assessment atau kandidat ditolak saat ada interview aktif; endpoint tetap memakai scope tenant.
- WebSocket interview kandidat kini menerapkan tenant dari session saat memuat assessment, memulai Gemini, memperbarui coverage, dan memeriksa batas waktu. Sebelumnya invite token tidak membawa tenant context sehingga `session.assessment` bernilai `nil` dan bootstrap Gemini crash.
- Model Live diganti dari model Gemini 2.0 yang tidak lagi tersedia ke `gemini-3.8-live`. Koneksi setup-only dengan key lokal mencapai `setupComplete` dan `Session ready` tanpa mengirim audio kandidat.
- Inflection Zeitwerk ditambahkan untuk nama class middleware `AudioWebSocketMiddleware` dan `CoverageWebSocketMiddleware`.

## Perubahan Frontend

- Hanya respons `401` yang menghapus token dan mengarahkan pengguna ke login. Respons `403` tidak lagi dianggap sebagai sesi kedaluwarsa.
- Halaman login membedakan kredensial salah, kegagalan koneksi, dan pesan error dari API.
- Halaman daftar assessment dan kandidat menyediakan tombol ikon tempat sampah merah dengan dialog konfirmasi dan pesan kegagalan.
- Halaman invite menampilkan skill di atas daftar kandidat sebagai chip primary yang membungkus ke baris berikutnya; hover menebalkan border tanpa menggeser layout, dan daftar kandidat scroll setelah lebih dari 8 data.
- Seed demo assessment `Senior Frontend Engineer` (ID 1) menyiapkan 9 skill dan 10 kandidat pending secara idempotent.

## Konfigurasi dan Dokumentasi

- Allowlist CORS lokal mencakup `localhost` dan `127.0.0.1` pada port frontend `5173` dan `5174`.
- Contoh konfigurasi menggunakan API dan WebSocket di port `3001` serta origin lokal eksplisit, bukan wildcard.
- README web dan API diperbarui untuk port API, folder frontend `web/`, nama variabel `GEMINI_FLASH_MODEL`, dan contoh token lokal.

## Verifikasi

- RSpec: **15 examples, 0 failures**.
- Rails Zeitwerk autoload check: **lulus**.
- Frontend TypeScript dan production build: **lulus**.
- `git diff --check`: **lulus**.
- Schema dimuat pada database test `rakamin_test` untuk menjalankan spec; database development tidak digunakan untuk setup test.

## Catatan

RuboCop masih melaporkan sejumlah pelanggaran style dan kompleksitas pada file-file yang diperiksa; cleanup besar di luar perubahan ini tidak dilakukan. File `web/package-lock.json` tetap untracked dan tidak diubah sebagai bagian dari pekerjaan ini.
