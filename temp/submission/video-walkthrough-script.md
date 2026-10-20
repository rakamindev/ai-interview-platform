# Naskah video walkthrough

**Target durasi:** sekitar 4 menit 30 detik
**Bahasa:** Indonesia
**Tujuan:** menunjukkan fokus UI pada Assessment dan Vacancies, menjelaskan P0 secara singkat, lalu menyampaikan bukti dan batasan yang relevan.

> Bagian **Tampilkan** adalah arahan layar, bukan untuk dibaca. Sesuaikan tempo dan kalimat dengan cara bicara sendiri. Jika demo langsung bermasalah, gunakan screenshot yang sudah tertanam di PDF report dan jangan mengarang hasil.

## Persiapan rekaman

- Jalankan aplikasi lokal lebih dulu dan siapkan data demo sintetis.
- Siapkan tab assessment, halaman portfolio, Fit/Gap, halaman notice kandidat, dan terminal berisi hasil test yang sudah dijalankan.
- Siapkan halaman atau file test untuk tenant isolation, parser level, Fit/Gap, dan worker lease.
- Pastikan tidak ada API key, token undangan, transcript asli, nama, atau email kandidat sungguhan di layar.
- Siapkan halaman PR setelah PR dibuat. Jangan merekam URL contoh atau placeholder sebagai URL nyata.

## Naskah dan urutan layar

### 0:00–0:25 | Pembuka

**Tampilkan:** assessment list, lalu portfolio kandidat demo.

**Ucapkan:**

> Halo, saya mengerjakan case study untuk platform interview dan assessment kandidat. Fokus utama saya frontend, terutama UI Assessment dan Vacancies. Saya ingin alur assessor untuk menyiapkan skill, mengatur requirement role, dan mengelola kandidat terasa jelas. Saat menelusuri alur sampai ke API, saya juga menemukan satu isu P0 yang perlu saya jelaskan singkat.

### 0:25–0:55 | Konteks dan prioritas

**Tampilkan:** halaman inventory prioritas pada PDF report, terutama baris P0 dan P1.

**Ucapkan:**

> Saya mulai dari pekerjaan assessor: membuat assessment, menentukan skill, mengundang kandidat, lalu mengatur vacancy dan requirement skill. Saya juga menelusuri API yang mendukung alur ini. Temuan paling kritis adalah akses hasil kandidat lintas tenant, jadi saya prioritaskan P0 itu sebelum membahas polesan UI.

### 0:55–1:35 | P0: batas tenant

**Tampilkan:** request spec lintas tenant atau hasil test. Gunakan data sintetis. Tunjukkan respons 404 dan assertion bahwa data tidak berubah.

**Ucapkan:**

> P0 artinya prioritas paling tinggi karena risikonya kritis. Sebelum perbaikan, assessor dari organisasi lain bisa membaca export portfolio dan mengubah skill jika mengetahui ID record. Ini berisiko membocorkan data kandidat dan memengaruhi proses hiring. Saya membatasi pencarian portfolio dan skill ke organisasi pemiliknya. Request lintas tenant sekarang mendapat 404 dan dicek dengan request spec.

### 1:35–2:20 | Demo UI Assessment

**Tampilkan:** daftar Assessment, form create/edit, pilihan skill dan level, lalu halaman undangan dengan status sesi.

**Ucapkan:**

> Di Assessment, assessor mengatur role, durasi, bahasa interview, skill, dan level yang diharapkan. Setelah konfigurasi tersimpan, assessor dapat membuat link undangan dan melihat status sesi kandidat. Saya berfokus pada hierarki informasi dan feedback form supaya konfigurasi dan langkah berikutnya mudah dipahami.

### 2:20–3:05 | Demo UI Vacancies

**Tampilkan:** daftar vacancy, buat atau edit vacancy, pengaturan status, dan skill dengan level ekspektasi. Bila tersedia, tunjukkan hubungan requirement dengan halaman Fit/Gap.

**Ucapkan:**

> Vacancy menyimpan kebutuhan role yang dipakai saat meninjau kandidat. Assessor bisa melihat daftar role, mengubah skill dan level, serta menutup vacancy yang tidak lagi aktif. Informasi ini kemudian dipakai pada perbandingan Fit/Gap, jadi requirement perlu mudah dibaca dan konsisten.

### 3:05–3:30 | Tampilan mobile

**Tampilkan:** tampilan mobile Assessment dan Vacancies, termasuk navigasi, form skill, dan dialog.

**Ucapkan:**

> Saya juga merapikan tampilan pada layar kecil. Navigasi tetap terlihat, judul lebih ringkas, nama dan teks panjang bisa membungkus, dan dialog dapat di-scroll jika isinya tinggi. Form tetap menggunakan area sentuh yang cukup untuk dipakai dengan jari.

### 3:30–4:05 | Bukti verifikasi

**Tampilkan:** output test yang sudah disiapkan dan riwayat dua commit seeded fault.

**Ucapkan:**

> Untuk bukti backend P0, request spec menguji pemisahan data antar tenant. Suite juga mencakup aturan hasil Fit/Gap dan parser level. Di sisi web, saya menjalankan test dan build. Seeded fault pada parser membuat 4 dari 5 contoh generator gagal; setelah fault di-revert, kelimanya lulus. Angka dan output yang saya tampilkan berasal dari hasil run di branch ini.

### 4:05–4:30 | Batasan dan penutup

**Tampilkan:** halaman constraint/submission status pada PDF report, lalu halaman PR jika sudah tersedia.

**Ucapkan:**

> Fokus utama saya di case study ini adalah frontend, terutama alur Assessment dan Vacancies. Penjelasan backend saya batasi pada hal yang perlu untuk memahami P0 dan bukti pengujiannya. Integrasi Gemini live serta kebijakan retensi masih memerlukan verifikasi dan keputusan lebih lanjut. Link PR dan demo saya cantumkan setelah tersedia. Terima kasih.

## Jika video harus dipersingkat

Pertahankan pembuka, demo Assessment/Vacancies, penjelasan P0, bukti test, dan batasan. Persingkat detail layar yang tidak menjadi fokus. Jangan menyebut PR, video host, smoke test Gemini, atau kebijakan retensi selesai jika memang belum.

## Pemeriksaan sebelum mengunggah

- Durasi akhir 3 sampai 5 menit.
- Gunakan data sintetis dan sembunyikan token, key, email, serta transcript kandidat nyata.
- Pastikan halaman PR benar-benar dapat dibuka oleh reviewer.
- Unggah ke layanan yang diizinkan, lalu tempel URL video nyata ke PDF submission.
- Jangan menyebut smoke test Gemini, kebijakan retensi, atau aksi PR selesai sebelum benar-benar dilakukan.
