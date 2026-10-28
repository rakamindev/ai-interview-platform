# 02. Analisis masalah dan jarak ke kondisi ideal

Dokumen ini membahas tiga temuan yang saya temukan saat mencoba aplikasi dan membaca lognya.

## Cara saya menilai

| Tingkat | Arti                                                               |
| ------- | ------------------------------------------------------------------ |
| P0      | Seseorang dirugikan atau disesatkan secara diam-diam di alur utama |
| P1      | Alur utama rusak dan terlihat jelas bagi semua orang               |

Label bukti:

- **Terbukti**: saya mengalami sendiri.
- **Dibaca dari kode**: saya membaca kode atau konfigurasi, tetapi tidak menjalankannya.

Jenis temuan: **implementasi rusak** berarti perilakunya sudah didefinisikan di wiki atau kode tetapi tidak berjalan benar. **Spesifikasi hilang** berarti hal itu tidak pernah didefinisikan.

## Ringkasan

| ID  | Tingkat | Jenis                                          | Lapisan            | Temuan                                                                                                               | Dampak pada alur kerja                                                                                                   | Bukti                                                                 | Status                                           |
| --- | ------- | ---------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------ |
| T-1 | P0      | Implementasi rusak, dan satu celah spesifikasi | web dan api        | Wawancara yang gagal ditampilkan kepada kandidat sebagai "Interview Complete. The interview has been recorded."      | Kandidat yang wawancaranya tidak pernah berjalan diberi tahu bahwa wawancara sudah direkam, lalu diminta menunggu hasil. | Terbukti: tiga screenshot, log backend, log `session_ended` di hook   | **Diperbaiki**                                   |
| T-2 | P1      | Implementasi rusak                             | api config dan web | Link undangan dibentuk dari `APP_BASE_URL`, yaitu alamat API, sehingga link membuka API dan bukan halaman wawancara. | Assessor mengirim link yang tidak membuka wawancara, dan kandidat tidak bisa memulai.                                    | Terbukti di lokal. Produksi dibaca dari kode                          | Tidak diperbaiki                                 |
| T-3 | P1      | Implementasi rusak                             | api config         | Nama model live bawaan ditolak Gemini dengan kode 1008, dan nama model berbeda di README, configmap, dan wiki.       | Dengan konfigurasi bawaan, setiap wawancara gagal dimulai.                                                               | Terbukti: log backend, dan perubahan konfigurasi lokal memperbaikinya | Tidak diperbaiki. Dipakai untuk mereproduksi T-1 |

## T-1. Wawancara gagal tampil sebagai selesai

Ada tiga kelompok jalur yang memaksa layar "complete":

1. **Saat halaman dimuat.** `candidate_info` hanya mengembalikan status. Setiap sesi `ended` menjadi "complete" apa pun alasannya.
2. **Pesan WebSocket `session_ended`.** Backend sudah mengirim `reason: 'error'` beserta pesan. Hook di frontend mengabaikan keduanya dan memasang "complete". Inilah jalur yang terjadi di screenshot saya, karena halaman tidak dimuat ulang.
3. **Jalur WebSocket dan jaringan lainnya.** Pesan `error` dengan `recoverable: false`, yaitu `auth_failed` dan `no_system_prompt`, koneksi yang tertutup setelah percobaan ulang habis, dan kegagalan request `candidate_info` semuanya berujung pada "complete".

Timeline temuan nama model yang salah:

| Waktu    | Yang dilihat kandidat                                  | Kenyataan                                                                        |
| -------- | ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 15:24:13 | "Briefly reconnecting" dan "Listening..."              | Model ditolak, dan backend mencoba ulang tiga kali dengan jeda 1, 2, dan 4 detik |
| 15:24:36 | "Interview Complete. The interview has been recorded." | Tidak ada yang direkam                                                           |
| 15:24:46 | Daftar assessor menampilkan sesi sebagai "Failed"      | Hanya assessor yang melihat kebenarannya, tanpa alasan                           |

## T-2. Link undangan mengarah ke backend

Alur buktinya:

- `session.rb` membentuk link dari `APP_BASE_URL`.
- `k8s/configmap.yaml` mengisi `APP_BASE_URL` dengan alamat domain API.
- `routes.rb` tidak memiliki rute `/interview`.
- `App.tsx` menunjukkan bahwa halaman wawancara berada di frontend, pada domain yang berbeda.
- Contoh link di wiki memakai domain aplikasi, bukan domain API.

## T-3. Nama model ditolak

Log backend menunjukkan Google menolak model `gemini-2.0-flash-live-001` karena tidak ditemukan untuk versi API v1beta atau tidak mendukung `bidiGenerateContent`. Backend mencoba ulang tiga kali, lalu menyerah. Setelah saya mengganti nama model di `config/application.yml` dan memulai ulang backend, sesi berjalan normal.

## Mengapa hanya T-1 yang saya kerjakan

- Tingkatnya paling tinggi, yaitu P0.
- Dampaknya langsung ke kandidat yang tidak memilih produk ini.
- Sebagian besar perbaikannya ada di frontend, sesuai fokus.
- Bagian backend yang diperlukan kecil.
- T-3 berpengaruh ke T-1.

## Sinyal kendala yang akan saya eskalasi ke Tech Lead

1. **Siklus hidup model.** Nama model bisa dihentikan penyedia. Aplikasi sebaiknya gagal saat startup dengan pesan yang jelas, bukan pada kandidat sungguhan yang pertama.
2. **Batas minimum upload (Mbps).** Di kondisi pengujian saya, nilai upload tertinggi hanya mencapai 1.5 Mbps, namun proses interview tetap bisa berjalan lancar. Sehingga bisa dipertimbangkan untuk menurunkan batas tersebut.
