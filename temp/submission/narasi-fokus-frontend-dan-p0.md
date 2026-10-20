# Narasi submission: fokus UI Assessment dan Vacancies

Dokumen ini membantu menyamakan cara saya menjelaskan kontribusi dengan fokus utama saya. Gunakan sebagai bahan untuk PDF dan walkthrough; sesuaikan kalimat "saya mengerjakan" dengan bagian yang memang saya implementasikan sendiri.

## Cara memosisikan kontribusi

Saya bisa menyebut fokus saya **frontend-heavy**, terutama UI untuk alur Assessment dan Vacancies. Saya tidak perlu berpura-pura memiliki kedalaman backend yang sama. Namun, brief ini tetap meminta pemahaman fullstack, jadi bagian backend jangan dihilangkan sama sekali. Jelaskan singkat dampak API ke UI, lalu beri porsi khusus untuk P0 karena risikonya menyangkut data kandidat.

### Assessment

> Saya berfokus pada alur assessor saat menyiapkan assessment: mengatur judul role, durasi dan bahasa interview, memilih skill serta level yang diharapkan, lalu mengelola undangan kandidat. UI perlu membuat konfigurasi itu jelas, memberi umpan balik saat form tidak valid, dan menunjukkan status sesi supaya assessor tahu langkah berikutnya.

### Vacancies

> Saya juga berfokus pada pengelolaan vacancy. Assessor dapat melihat role yang tersedia, membuat atau mengubah requirement skill, dan menentukan status vacancy. Requirement ini dipakai lagi saat hasil kandidat dibandingkan di Fit/Gap, jadi label skill dan level yang diatur di sini harus mudah diperiksa.

### UI dan tampilan mobile

> Di sisi frontend, saya memperhatikan state yang ditemui assessor saat bekerja: data tersedia, daftar kosong, request gagal, validasi form, dan teks panjang. Saya juga merapikan tampilan mobile agar navigasi, judul, form, dialog, dan daftar tetap muat serta mudah digunakan di layar kecil.

Pilih contoh layar yang benar-benar ada di branch saat demo. Jangan menyebut komponen atau state sebagai kontribusi baru jika hanya sudah ada sebelumnya.

## Penjelasan backend yang singkat

> Backend menyediakan data dan aturan yang dipakai UI. Saya menelusuri kontrak API untuk memastikan data assessment, skill, status vacancy, dan hasil kandidat ditampilkan sesuai maknanya. Ada satu isu backend yang saya jelaskan lebih lengkap karena tingkat risikonya P0: akses portfolio lintas tenant.

Kalimat ini cukup untuk mengantar bagian backend. Tidak perlu menguraikan Rails, database, Redis, atau worker satu per satu kecuali reviewer bertanya.

## P0 dengan bahasa sederhana

**P0** adalah prioritas paling tinggi untuk masalah yang berisiko kritis. Di kasus ini, masalahnya bukan layout atau kenyamanan: data hasil interview seorang kandidat bisa terbaca atau diubah oleh assessor dari organisasi lain.

Setiap organisasi di aplikasi disebut **tenant**. Sebelum perbaikan, beberapa endpoint mencari portfolio hanya berdasarkan ID. Karena pemeriksaan kepemilikan tenant tidak ikut dilakukan pada jalur itu, ID portfolio atau skill dari tenant lain dapat membuka akses lintas organisasi.

Audit lokal mencatat reproduksi dengan data uji sintetis: request export dari tenant lain sempat menerima `200` beserta isi portfolio, dan override skill lintas tenant sempat tersimpan. Karena isinya mencakup bukti, rating, catatan assessor, dan ringkasan kandidat, dampaknya dapat menyentuh privasi sekaligus keputusan hiring. Itulah alasan temuan ini masuk P0.

Perbaikannya membatasi pencarian portfolio dan skill melalui tenant pemiliknya. Jika assessor meminta data milik tenant lain, API mengembalikan `404`, sehingga data tidak dibocorkan dan keberadaan record tidak dikonfirmasi. Request spec lintas tenant menjadi pemeriksaan regresinya. Perbaikan ini tercatat pada commit `51f9aae`.

### Versi lisan 20-30 detik

> Saya menemukan isu P0 pada akses hasil kandidat. Sebelum diperbaiki, assessor dari organisasi lain bisa membaca export portfolio dan mengubah skill jika mengetahui ID record. Ini berisiko membocorkan data kandidat dan memengaruhi hasil hiring. Saya membatasi pencarian resource ke tenant pemiliknya; akses lintas tenant sekarang mendapat 404 dan dilindungi request spec.

## Jika reviewer bertanya: "Kenapa UI-focused, tetapi membahas P0?"

> Fokus kontribusi utama saya adalah UI Assessment dan Vacancies. Saat menelusuri alur sampai ke API, saya menemukan P0 yang terlalu berisiko untuk dilewati. Saya menjelaskan backend secukupnya untuk menunjukkan dampak dan cara memastikan aksesnya aman, sementara pembahasan utama tetap pada pengalaman assessor di frontend.

## Batas klaim

- Gunakan contoh dan screenshot dengan data sintetis; jangan tampilkan nama, email, transcript, token, atau audio kandidat sungguhan.
- Jangan menyebut sistem "patuh UU PDP" berdasarkan perbaikan ini saja. Kebijakan retensi dan penghapusan data masih membutuhkan keputusan pemilik produk dan peninjauan yang sesuai.
- Jangan menyebut semua perubahan frontend sebagai pekerjaan baru. Tunjukkan bagian yang memang diubah pada branch dan jelaskan sisanya sebagai konteks alur produk.
- Dokumen sumber audit `temp/audit-brief-fullstack.md` saat ini masih memosisikan kedalaman engineering sebagai **backend-heavy**. Samakan bagian itu menjadi **frontend-heavy** pada PDF final agar selaras dengan narasi yang dipakai saat presentasi.

## Urutan demo yang disarankan

1. Mulai dari Assessment: konfigurasi role, skill, level, lalu halaman undangan kandidat.
2. Tunjukkan Vacancies: daftar role dan pengaturan requirement yang nantinya dipakai pada Fit/Gap.
3. Tunjukkan satu detail responsive di mobile, misalnya navigasi, form skill, atau dialog.
4. Jelaskan P0 selama 20-30 detik dengan bukti request spec atau ringkasan hasil uji sintetis.
5. Tutup dengan batasan yang masih terbuka dan link PR/video yang benar-benar tersedia.
