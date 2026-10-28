# Rencana Retry hardware dan pemeriksaan mobile

Tanggal: 28 Oktober 2026. Spec: instruksi pengguna untuk memperbaiki Retry hardware, memeriksa mobile, mendokumentasikan hasil, dan memisahkan commit.

**Goal:** kandidat dapat mengulang precheck tanpa reload; alur utama tetap terbaca dan kontrol dapat digunakan pada viewport kecil.

**Architecture:** pertahankan checklist/desain existing. Isolasi setiap percobaan hardware dengan remount internal, batalkan timer/hasil asynchronous yang kedaluwarsa, dan lepaskan stream, animation frame, serta AudioContext. Mobile diperiksa di browser nyata dengan data sintetis sebelum memilih perubahan layout.

**Tech stack:** React/TypeScript, Vitest, Vite, browser Edge/Playwright yang sudah tersedia.

## Batas

- Tidak membaca .env/application.yml/credential; tidak memakai Gemini atau mikrofon/kamera pengguna.
- Naskah video lokal tidak ikut commit.
- Tidak mengubah threshold internet, engine penilaian, maupun nilai Required fit/gap.
- Viewport emulation tidak dianggap uji ponsel fisik atau semua browser mobile.

## Tahap 1 - Retry (commit sendiri)

- [x] Regression gagal: internet gagal -> Retry -> OS/internet diulang -> mic/output Passed -> Start aktif.
- [x] Regression penolakan mic -> Retry setelah izin tersedia; respons jaringan reject menjadi Failed.
- [x] Resource percobaan lama dan hasil izin terlambat dilepas saat retry/unmount.
- [x] Perbaiki HardwareCheck tanpa mengubah props publik onStart.
- [x] Jalankan tes, typecheck/build; simpan red/green dan penjelasan sebelum commit.

## Tahap 2 - Mobile (commit terpisah)

- [x] Periksa precheck, interview aktif/kontrol, portfolio, fit/gap pada 360/390/768 px; pembanding desktop 1280 px.
- [x] Pakai nama/skill panjang dan data fixture, tanpa API/credential nyata.
- [x] Rekam overflow dan screenshot sebelum perubahan. Perbaiki hanya masalah yang terbukti.
- [x] Pastikan tabel dapat ditelusuri tanpa membuat seluruh halaman overflow; tombol utama terlihat/dapat diklik.
- [x] Simpan hasil, batas uji, screenshot sesudah, dan commit terpisah.

Risiko yang diperiksa: hasil async lama menimpa hasil baru, izin mic kembali setelah unmount, resource mic/audio tertinggal, Start aktif saat retry belum selesai, dan kontrol/tabel melampaui viewport.

Hasil: Retry commit 829f073; E13 before 8/16 gagal -> after16/16 lulus. Final review statis tidak menemukan blocker; batas autoplay override dan scroll programatik dicantumkan.
