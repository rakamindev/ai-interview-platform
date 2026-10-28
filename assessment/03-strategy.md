# 03. Strategi perbaikan T-1

## Jarak ke kondisi ideal

Idealnya, saat wawancara gagal, kandidat diberi tahu yang sebenarnya dan tahu langkah berikutnya. Sekarang, kandidat melihat "Interview Complete. The interview has been recorded." Rinciannya ada di `02-findings.md`.

## Kriteria penerimaan

| ID    | Kondisi                                                                                 | Hasil yang diharapkan                                                                                                                                                  |
| ----- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01 | Halaman dimuat, sesi `ended` dengan `end_reason` bernilai `error`                       | Layar error                                                                                                                                                            |
| AC-02 | Halaman dimuat, sesi `ended` dengan alasan selesai yang dikenal, atau tanpa alasan      | Layar selesai                                                                                                                                                          |
| AC-03 | Halaman dimuat, sesi `failed`, atau `ended` dengan alasan yang tidak dikenal            | Layar error                                                                                                                                                            |
| AC-04 | Halaman dimuat, sesi `pending` atau `active`                                            | Alur wawancara seperti biasa                                                                                                                                           |
| AC-05 | `candidate_info` menjawab 404                                                           | Layar "Link tidak valid"                                                                                                                                               |
| AC-06 | `candidate_info` gagal karena jaringan atau server                                      | Layar "Tidak bisa menghubungi server"                                                                                                                                  |
| AC-07 | WebSocket mengirim `session_ended` dengan `reason` bernilai `error`, tanpa memuat ulang | Layar error                                                                                                                                                            |
| AC-08 | WebSocket mengirim `session_ended` dengan alasan lain yang dikenal                      | Layar selesai                                                                                                                                                          |
| AC-09 | Koneksi putus, percobaan ulang habis, dan tidak ada `session_ended`                     | Layar "Tidak bisa terhubung", bukan layar selesai                                                                                                                      |
| AC-10 | Isi layar error                                                                         | Tidak menyebut "direkam", tidak menampilkan `message` mentah dari backend, menyatakan ini bukan kesalahan kandidat, dan meminta kandidat menghubungi pengirim undangan |
| AC-11 | Tampilan layar error                                                                    | Teks tidak terlalu panjang, dan memakai `role="alert"`                                                                                                                 |
| AC-12 | Backend `candidate_info`                                                                | Mengembalikan `session_status` dan `end_reason` untuk token yang valid, dan 404 tanpa data untuk token yang salah                                                      |
| AC-13 | Banner saat koneksi mencoba ulang                                                       | Tidak menulis "Listening..." dan tidak menjanjikan pemulihan                                                                                                           |

## Kasus tepi

- **Alasan tidak dikenal.** Saya tampilkan layar error.
- **Sesi lama tanpa alasan.** Saya anggap selesai.
- **Teks panjang di layar sempit.** Teks terbungkus dan tidak ada scroll horizontal.

## Opsi solusi

| Opsi                                                                                                           | Dampak dan biaya                                                                   | Perawatan                                                          | Cara gagal                                                                     |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| A. Memetakan `reason` dari pesan WebSocket saja                                                                | Kecil dan cepat. Tidak mencakup koneksi putus dan tombol End.                      | Sederhana, tetapi logikanya hanya ada di hook.                     | Kalau pesan tidak sampai, layar bisa salah.                                    |
| B. Setelah pesan atau koneksi putus, ambil `candidate_info` dan putuskan dari database                         | Mencakup semua jalur, dengan satu request tambahan.                                | Satu sumber kebenaran.                                             | Kalau request gagal, perlu layar khusus. Ada jeda singkat sebelum layar akhir. |
| C. Satu aturan keputusan untuk semua jalur: A untuk pesan WebSocket yang membawa alasan, B saat halaman dimuat | Semua kasus tercakup. File yang diubah paling banyak, tetapi tiap perubahan kecil. | Fungsi murni dengan tes berbasis tabel, dan mudah ditarik kembali. | Alasan sukses baru yang belum terdaftar akan tampil sebagai error.             |

## Keputusan: opsi C dengan lingkup kecil

- Dua fungsi murni di `web/src/utils/interviewScreen.ts`, yaitu `screenForReason` untuk alasan sesi yang berakhir dan `screenForSession` untuk data saat halaman dimuat.
- Backend: `candidate_info` ikut mengembalikan `end_reason`. Tidak perlu migrasi karena kolomnya sudah ada. Backend WebSocket tidak saya ubah karena sudah mengirim `reason`.
- Saya mengirim `end_reason` apa adanya.
- Alasan memilihnya: semua jalur tertutup, mudah diuji, dan cukup kecil untuk diselesaikan.

## Asumsi dan lingkungan uji

- **A-01.** Lingkungan: Linux mint, Ruby 3.3.2, PostgreSQL 16 dan Redis di Docker, Node 24. API di port 3001 dan web di port 5173.
- **A-02.** Saya menurunkan `minUploadMbps` dari 4 menjadi 1 hanya di lokal. Perubahan ini tidak masuk PR.
- **A-03.** Token dev dibuat secara lokal dengan `SECRET_KEY_BASE` acak milik saya.
- **A-04.** Nama model live bawaan ditolak, jadi saya mengubahnya di lokal menjadi `gemini-3.8-live`. Saya hanya bisa memastikan bahwa API menerimanya.
- **A-05.** Sesi berstatus `ended` tanpa `end_reason` dianggap selesai, karena kemungkinan data lama.
- **A-06.** Database menyimpan sesi gagal sebagai `ended` dengan `end_reason: error`.
