# Agenda 2 - Case Study Presentation

Alokasi waktu: total 120 menit dibagi 5 kandidat, jadi sekitar 20 sampai 24 menit per orang. Target presentasi ini 5 menit, sisanya dipakai untuk tanya jawab bersama CTO.

Panduan waktu:
- Pembuka dan konteks: 45 detik
- Temuan masalah: 1 menit
- Solusi dan keputusan arsitektur: 2 menit
- Validasi dan catatan teknis: 1 menit
- Penutup: 15 detik

---

## Naskah Presentasi

Pembuka dan konteks (45 detik)

Selamat sore Pak, dan terima kasih sudah diberi kesempatan untuk presentasi hari ini. Perkenalkan, nama saya Risna Berti Sundari.

Project yang saya kerjakan adalah AI Interview Platform, sebuah sistem wawancara kandidat berbasis suara real-time yang ditenagai Gemini Live API. Alurnya dimulai dari admin yang membuat assessment berupa rubrik skill, lalu kandidat diberi invite untuk melakukan interview dengan AI secara langsung. Sesi percakapan dianalisa di belakang layar untuk menghitung cakupan skill kandidat, lalu hasilnya dirangkum menjadi portfolio yang bisa dibandingkan dengan lowongan yang tersedia.

Sebelum masuk ke bagian teknis, saya mau menjelaskan bahwa saya tidak langsung menambah fitur baru. Saya mulai dengan membaca seluruh codebase dan menjalankan alur utama dari ujung ke ujung, untuk melihat bagian mana yang benar-benar bekerja dan bagian mana yang hanya terlihat utuh dari luar.

Temuan masalah (1 menit)

Setelah dijalankan, saya menemukan tiga kelompok masalah yang cukup serius.

Yang pertama dan paling menentukan adalah soal konfigurasi model AI. Nama modelnya ditulis langsung di dalam kode, sementara model tersebut sudah tidak lagi tersedia di sisi provider. Akibatnya fitur inti, mulai dari interview suara sampai analisis coverage dan pembuatan portfolio, gagal dijalankan. Jadi ini bukan isu kecil, tapi benar-benar blocker.

Yang kedua adalah perilaku AI saat interview. Ada tiga hal yang saya lihat langsung dari transcript. Pertama, jeda hening antar kalimat terlalu pendek, hanya sekitar 1 detik, sehingga ketika kandidat sedang berpikir, AI sudah menyela. Kedua, teks internal seperti penanda sistem dan metadata JSON ikut terbaca keluar, padahal itu pesan antar sistem yang tidak boleh didengar kandidat. Ketiga, AI menutup sesi lebih awal dengan alasan semua skill sudah tercakup, padahal di data sebenarnya masih ada dua skill yang belum diperiksa dan waktu interview masih tersisa banyak.

Yang ketiga adalah sisi autentikasi dan isolasi data. Tabel pengguna di database masih kosong, dan login belum terhubung ke database sama sekali. Frontend mengambil token development langsung dari environment variable, lalu menganggap itu sudah login. Sementara itu, aturan multi-tenant masih mempercayai input yang dikirim dari client. Saya menganggap ini perlu dibereskan, karena kalau dilepas ke publik, ini menjadi celah keamanan yang cukup serius.

Solusi dan keputusan arsitektur (2 menit)

Dari temuan tersebut, prinsip utama yang saya pakai adalah sederhana: backend memegang kendali, AI hanya menjalankan instruksi. Keputusan bisnis seperti mengakhiri interview tidak boleh bertumpu pada model yang sedang berbicara.

Untuk audio dan perilaku AI ada tiga perubahan. Delay deteksi hening saya naikkan dari 1 detik ke 2,5 detik supaya kandidat punya ruang bernapas dan berpikir sebelum AI merespons. Angka ini saya pilih setelah mencoba beberapa kali: terlalu kecil seperti yang semula membuat terasa terpotong, terlalu besar membuat percakapan melambat, dan 2,5 detik terasa paling pas. Lalu system prompt saya pangkas dari sekitar 10 kilobyte menjadi 8,6 kilobyte, dan aturannya saya ubah jadi lebih singkat dan tegas. Hasil yang paling penting: tidak ada lagi teks internal yang bocor keluar. Ketiga, wewenang menutup sesi saya ambil dari AI dan diberikan ke backend. Backend hanya akan menutup sesi kalau coverage analysis benar-benar mengonfirmasi semua skill sudah covered. Kalau AI mencoba menutup lebih awal, backend mengirim sinyal untuk melanjutkan. Kalau kandidat sendiri yang pamitan, itu dihormati dan sesi langsung diakhiri.

Untuk autentikasi dan multi-tenant, token development tersebut saya hapus dari kode dan dari konfigurasi environment, lalu diganti dengan login nyata ke tabel pengguna. Saya tambahkan kolom tenant_id, dan sekarang alurnya begini: pengguna membuka halaman di subdomain tertentu, sistem mencari organization yang cocok dengan host tersebut, lalu backend memeriksa apakah akun itu memang terdaftar di tenant itu. Kalau tidak cocok, aksesnya ditolak. Jadi tidak ada lagi penentuan tenant yang berasal dari client.

Lalu sisi ketahanan dan tampilan. Frontend sebelumnya hanya mencoba reconnect selama sekitar 7 detik lalu langsung menampilkan selesai, padahal backend masih memberi waktu 120 detik. Saya selaraskan dengan menambah jumlah percobaan reconnect menjadi delapan dengan jeda yang bertahap, lalu ditambah tombol retry yang jelas. Selain itu ada perbaikan kecil tapi penting: ekspor PDF yang gagal karena karakter hasil keluaran AI, seperti em-dash dan beberapa karakter non-ASCII, sekarang bisa diunduh normal. Speed test juga saya arahkan ke endpoint di backend sendiri supaya tidak bergantung pada layanan pihak ketiga yang sering tidak stabil.

Validasi dan catatan teknis (1 menit)

Untuk validasi, saya susun 22 skenario uji dan semuanya sudah saya jalankan dan verifikasi langsung di browser, mulai dari login, membuat assessment, mengirim invite, menjalankan interview, sampai menghasilkan portfolio dan laporan perbandingan.

Buktinya paling terlihat dari transcript. Saya membandingkan transcript sebelum dan sesudah perbaikan. Setelah diperbaiki, AI tidak lagi memotong kandidat di tengah berpikir, tidak ada teks sistem yang terbaca ke kandidat, dan ketika interview selesai, AI menjelaskan dulu bahwa semua topik sudah dibahas, baru menutup dengan sopan. Data coverage juga jalan sesuai tahapnya, dari belum dibahas, sebagian, sampai selesai.

Saya juga mau jujur menyebutkan satu hal yang belum selesai, karena lebih baik saya sampaikan sekarang daripada nanti ditemukan. Query untuk mengambil portfolio belum di-scope per tenant secara ketat. Dampaknya baru terasa kalau ada pengguna dari tenant lain yang mengetahui ID portfolio, tapi ini tetap harus diperbaiki sebelum sistem dipakai di production. Selain itu, tabel anak seperti portfolio dan laporan perbandingan juga belum punya tenant_id langsung, sehingga pengisolasiannya masih bergantung pada relasi ke tabel induk. Keduanya sudah saya catat sebagai pekerjaan lanjutan dengan prioritas yang jelas.

Penutup (15 detik)

Itu ringkasan pengerjaan dan pertimbangan arsitekturnya. Saya serahkan ke Pak untuk pertanyaan dan diskusinya. Terima kasih.

---

## Catatan Antisipasi Pertanyaan

**Kenapa backend yang memutuskan akhir sesi, bukan AI?**
Karena AI bisa salah menilai. Dari transcript terlihat AI sudah merasa selesai, padahal masih ada skill yang belum diperiksa. Kalau keputusan bisnis bertumpu pada model, hasilnya tidak konsisten. Jadi backend memakai data coverage analysis sebagai acuan, dan AI hanya menjalankan. Prinsipnya sama seperti validasi di backend: percayai data, bukan perkiraan.

**Kenapa angka 2,5 detik untuk jeda hening?**
Dulu 1 detik terlalu pendek sehingga jeda berpikir dianggap selesai bicara. Saya naikkan ke 2,5 detik setelah mencoba beberapa nilai, karena terlalu besar membuat percakapan terasa lambat. Ini kompromi yang saya pilih, dan kalau diuji dengan data lebih banyak angkanya bisa disesuaikan lagi.

**Apa yang berubah di bagian login?**
Sebelumnya frontend mengambil token development dari environment variable dan menganggap itu sudah login, tanpa menyentuh database. Sekarang token tersebut dihapus, tabel pengguna diisi, dan login dicek terhadap email, password, serta kecocokan tenant. Pesan error juga dibedakan, supaya pengguna tahu apakah email tidak ditemukan, password salah, atau akun tidak punya akses ke tenant tersebut.

**Bagaimana cara memastikan satu tenant tidak bisa melihat data tenant lain?**
Tenant ditentukan dari subdomain yang dipetakan ke organization di database, lalu backend memeriksa kecocokan akun dengan tenant tersebut sebelum memberi akses. Data dari client tidak dipakai sebagai penentu tenant. Untuk pengambilan data, masih ada beberapa query yang belum di-scope ketat, dan itu bagian yang harus saya rapikan berikutnya.

**Kenapa pakai kolom tenant_id di tabel pengguna, bukan tabel keanggotaan?**
Satu keanggotaan sederhana, satu pengguna untuk satu tenant, dan itu cukup untuk membuktikan isolasi di demo. Tabel keanggotaan lebih fleksibel, tapi menambah kompleksitas yang belum diperlukan sekarang. Kalau nanti ada kebutuhan satu orang untuk beberapa tenant, itu bisa ditambahkan tanpa mengubah fondasi yang sekarang.

**Kalau AI tetap mencoba menutup sesi lebih awal?**
Backend mengirim sinyal untuk melanjutkan, maksimal tiga kali. Kalau setelah itu coverage-nya memang belum lengkap, backend yang memutuskan sendiri untuk mengakhiri sesi dengan alasan waktu habis.
