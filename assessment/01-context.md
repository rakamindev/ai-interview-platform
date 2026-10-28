# 01. Konteks produk dan domain

## Produk

Platform ini menjalankan wawancara audio dengan pewawancara AI. Assessor membuat asesmen dan mengirim link undangan. Kandidat berbicara dengan AI, lalu sistem menghasilkan portofolio skill dengan level L1 sampai L5 dan kutipan bukti. Assessor bisa mengoreksi hasilnya.

Saya mencoba alurnya dari ujung ke ujung, sebagai assessor dan sebagai kandidat, lalu membaca wiki PRD 01 dan PRD 02 untuk membandingkannya dengan perilaku aplikasi.

## Industri

Berikut pemahaman awal saya:

- Satu lowongan magang yang saya lamar menampilkan 287 pelamar. Menyaring banyak orang dengan waktu manusia yang terbatas itu sulit.
- CV dan tes pilihan ganda sudah umum, tetapi kurang menunjukkan cara seseorang berpikir.
- Wawancara terstruktur memberi informasi terbaik, tetapi sulit diperbanyak. Di sinilah produk ini mencoba memberi nilai.

## Tujuan produk

Memberi gambaran kemampuan kandidat yang sesuai dan berbasis bukti, yang bisa diperiksa manusia. Agar tetap berguna, apa yang dikatakan sistem tentang sebuah wawancara harus benar.

## Pengguna

- **Assessor** membuat asesmen, mengirim link, dan membaca hasil. Mereka membutuhkan link yang berfungsi, status sesi yang jelas, dan alasan saat sesi gagal.
- **Recruiter dan hiring manager** memakai hasilnya untuk memutuskan. Mereka butuh hasil yang bisa dipercaya dan dijelaskan.

## Kandidat

Kandidat dinilai tanpa memilih sistem ini dan tidak bisa menolak. Hasil yang salah bisa sangat berpengaruh. Yang mereka butuhkan adalah link yang bisa dibuka, pesan yang jujur, dan langkah berikutnya saat ada gangguan.

Pengalaman saya sendiri menunjukkan hal ini. Saat wawancara gagal, layar lama memberi tahu saya bahwa wawancara "sudah direkam". Padahal tidak ada yang direkam.

## UU PDP

Saya bukan ahli hukum, jadi ini pemahaman dasar saya dari Undang-Undang Nomor 27 Tahun 2022.

- **Pasal 5.** Subjek data berhak mendapat informasi. Karena itu layar kandidat tidak boleh menyebut "direkam" kalau tidak ada rekaman.
- **Pasal 10 ayat 1.** Subjek data bisa mengajukan keberatan atas keputusan yang hanya didasarkan pada pemrosesan otomatis. Karena itu hasil AI tidak boleh menjadi satu-satunya dasar keputusan, dan fitur koreksi assessor penting.
- **Data yang diproses.** Nama dan id kandidat, token undangan, audio yang diteruskan ke Gemini, dan transkrip.
