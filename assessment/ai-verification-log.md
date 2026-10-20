# AI Verification Log

## 1. Cara Saya Menggunakan AI

### 1.1 Backend
* **Konsep dari Saya, Kodingan dari AI:** Untuk backend, konsepnya saya yang kendalikan, sedangkan teknis penulisan kodenya saya serahkan ke AI.
* **Evaluasi Berbasis Hasil & Uji Manual:** Evaluasi yang saya lakukan selalu berbasis hasil. Selain pengujian otomatis yang dijalankan oleh AI, saya selalu meminta beberapa skenario pengujian manual yang bisa saya coba sendiri lewat terminal atau konsol.
* **Perbaikan Jika Hasil Tidak Sesuai:** Jika hasil dari pengujian manual tersebut gagal atau tidak sesuai dengan yang diharapkan, saya menyuruh AI untuk mengevaluasi apa yang salah dan memperbaiki kodenya.

### 1.2 Frontend
* **Tanya Kelayakan di Awal:** Sebelum membuat sesuatu di frontend, saya biasanya bertanya terlebih dahulu ke AI: *"apakah ini memungkinkan untuk dibuat?"*. Kalau memungkinkan, baru dibuat.
* **Kendali Lebih Penuh:** Konsep tampilan dari saya dan kodingannya dari AI, tetapi untuk frontend saya memegang kendali lebih penuh terhadap kodingan dan tampilannya. Kalau ada UI yang tidak pas atau kurang rapi, saya minta diperbaiki lagi atau saya perbaiki sendiri mana yang bagusnya.
* **Evaluasi Langsung di Browser:** Evaluasi frontend juga berbasis hasil dengan mengecek langsung tampilannya di browser pada berbagai ukuran layar (desktop, tablet, dan mobile) untuk memastikan tidak ada tampilan yang rusak atau terpotong.

### 1.3 Diskusi dan Pertanyaan Skenario ("Bagaimana Jika...")
Saat berdiskusi dengan AI, saya tidak langsung menerima apa yang dibuat begitu saja. Saya sering bertanya:
* *"Bagaimana kalau misalnya begini?"*
* *"Bagaimana jika skenario ini terjadi?"*

Pertanyaan-pertanyaan ini saya gunakan untuk memahami kode yang sudah dibuat AI, sekaligus menguji berbagai contoh skenario yang mungkin terjadi agar aplikasinya tidak bermasalah saat digunakan.

---

## 2. Contoh Kasus Saat Saran atau Kodingan AI Diperbaiki

### Kasus 1: Penggantian Model Gemini
* **Masalah:** Model Gemini lama (`gemini-2.0-pro-001`) menghasilkan error 404 dari Google.
* **Saran Awal AI:** AI langsung menyarankan untuk mengganti model flash dan pro sekaligus ke versi 2.5 di konfigurasi.
* **Tanggapan Saya:** Saya bertanya kenapa model flash harus ikut diganti padahal yang bermasalah awalnya adalah model pro, lalu meminta AI menguji langsung panggilan API-nya.
* **Hasil Pengujian:**
  1. Model `gemini-2.5-pro` ditolak Google karena sudah tidak tersedia untuk pengguna baru.
  2. Model Pro baru memiliki kuota 0 pada API key gratis (error 429).
  3. Setelah dicek ke API Google, model yang masih aktif dan kuotanya lancar adalah `gemini-3.8-flash`.
* **Perbaikan:** Konfigurasi diarahkan ke `gemini-3.8-flash` sehingga proses AI berjalan normal.

### Kasus 2: Tombol Analisis dan Lebar Kontainer di Mobile
* **Masalah:**
  1. Tombol untuk menjalankan analisis Fit/Gap di halaman portofolio tidak terlihat di layar ponsel.
  2. Lebar kartu pada lobi wawancara tidak pas dengan lebar header.
* **Kondisi Awal Kode AI:**
  1. Kontrol Fit/Gap dibuat menyamping (`flex items-center gap-3`) dengan lebar dropdown yang kaku (`w-56`), sehingga di layar ponsel tombol analisis terdorong keluar layar ke sebelah kanan.
  2. Kontainer lobi tidak memakai kelas `w-full` di dalam flexbox, sehingga lebarnya menyusut mengikuti isi teks dan tidak sejajar dengan header.
* **Tindakan Saya:**
  Saat mengecek tampilan di browser dengan mode responsive ponsel (iPhone), saya melihat tombol analisis tidak muncul dan lebar lobi tidak sejajar. Saya menyuruh AI mengecek penyebabnya dan memperbaikinya.
* **Perbaikan:**
  1. Tombol dan dropdown analisis dibungkus dalam kartu tersendiri dan diatur bertumpuk vertikal di mobile (`flex-col sm:flex-row`) dengan lebar `w-full`, sehingga tombol muncul jelas di layar ponsel.
  2. Kontainer lobi ditambahkan `w-full` agar lebarnya pas dan sejajar dengan logo di header.

### Kasus 3: Catatan Asesor Terhapus Saat Portofolio Diproses Ulang (DATA-01)
* **Kondisi Awal Kode AI:** Kode bawaan memanggil `destroy_all` pada data skill setiap kali portofolio dianalisis ulang. Karena ada relasi hapus otomatis, catatan dan nilai koreksi manual yang sudah diisi asesor ikut terhapus.
* **Arahan Saya:** Data hasil analisis AI boleh dibuat ulang, tetapi koreksi manual dan catatan dari asesor manusia tidak boleh hilang.
* **Perbaikan:** Logika penyimpanan diubah agar memperbarui data yang ada (*upsert/merge* di memori) tanpa menghapus data koreksi asesor. Hasilnya diverifikasi dengan pengujian otomatis RSpec dan uji manual.
