# Panduan Rekam Video — Detail Banget

Target **4 menit 30 detik**. Maksimal 5 menit.

Anda **hanya butuh 2 aplikasi**:

| Aplikasi | Dipakai untuk |
|---|---|
| **Google Chrome** | Menampilkan gambar, aplikasi, dan kode |
| **Cursor** | Cuma untuk terminal-nya (jalankan test) |

Kode **tidak** dilihat di Cursor. Kode dilihat lewat GitHub di Chrome. Jadi Anda tidak perlu buka file apa pun di Cursor.

---

# BAGIAN A — Persiapan (30 menit sebelum rekam)

## A1. Nyalakan aplikasinya

Buka **Cursor**. Tekan **Ctrl + `** (tombol backtick, di kiri angka 1) untuk membuka terminal di bawah.

Ketik ini, lalu Enter:

```bash
cd D:/Project/Testing/Rakamin/ai-interview-platform && docker compose up -d
```

Tunggu sampai muncul tulisan `Started`. Kira-kira 30 detik.

Sekarang buka terminal **kedua**. Di Cursor klik tanda **+** di pojok kanan panel terminal. Ketik:

```bash
cd D:/Project/Testing/Rakamin/ai-interview-platform/web && npm run dev
```

Biarkan terminal ini jalan terus. **Jangan ditutup.** Kalau muncul `Local: http://localhost:5173/` berarti sudah benar.

## A2. Cek aplikasinya hidup

Kembali ke terminal **pertama**. Ketik:

```bash
curl http://localhost:3001/health
```

Harus muncul: `{"status":"ok"}`

Kalau belum muncul, tunggu 30 detik lagi lalu ulangi.

## A3. Siapkan 4 tab Chrome

Buka **Google Chrome**. Buat 4 tab, **urut dari kiri ke kanan**. Cara buat tab baru: **Ctrl + T**.

Copy-paste link ini satu per satu:

**Tab 1** — gambar "sebelum diperbaiki"
```
file:///D:/Project/Testing/Rakamin/ai-interview-platform/assessment/screenshots/00-BEFORE-fitgap-desktop.png
```

**Tab 2** — aplikasi yang sudah diperbaiki
```
http://localhost:5173/assessments/2/sessions/2/fitgap/2
```

**Tab 3** — kode lama yang bermasalah
```
https://github.com/myst-al/ai-interview-platform/blob/main/api/app/services/portfolios/generator.rb#L161
```

**Tab 4** — bukti test-nya gagal saat bug ditanam
```
https://github.com/myst-al/ai-interview-platform/commit/075e96e
```

> **Penting:** cek Tab 2 sekarang. Harus muncul tabel dengan kolom **Required** terisi (L4, L3, L4, L3, L3, L3, L2). Kalau halamannya kosong atau minta login, lompat ke **Bagian D — Kalau Ada Masalah** di bawah.

## A4. Rapikan layar

1. Di Chrome tekan **Ctrl + Shift + Plus** sampai zoom jadi **110%** (lihat di pojok kanan address bar)
2. Tutup WhatsApp, Slack, email — jangan sampai ada notifikasi muncul
3. Tutup tab Chrome lain yang tidak dipakai

## A5. Pasang aplikasi perekam

Pakai **Loom** — paling gampang, dan langsung memberi link.

1. Buka https://www.loom.com → **Sign up** (gratis)
2. Install extension Chrome-nya
3. Klik ikon Loom di pojok kanan atas Chrome
4. Pilih **Screen + Cam** (atau **Screen only** kalau tidak mau muncul wajah)
5. Pilih **Full screen**
6. Pastikan microphone-nya benar (ada indikator bergerak saat Anda bicara)

## A6. Tes rekam 20 detik

**Jangan lewati langkah ini.** Rekam 20 detik, bicara apa saja, lalu putar ulang. Pastikan **suara Anda terdengar**. Banyak orang merekam 5 menit lalu baru sadar mic-nya mati.

---

# BAGIAN B — Rekaman

Tulisan **UCAPKAN** dibaca keras-keras, kata per kata. Baca **pelan**. Berhenti sebentar antar kalimat itu bagus — terdengar tenang.

Kalau salah ngomong: diam 2 detik, ulangi kalimatnya saja. **Jangan ulang dari awal.**

---

## 🎬 BAGIAN 1 — Masalahnya (0:00 – 0:35)

### 👉 Klik **Tab 1** (gambar "sebelum")

**UCAPKAN:**

> "Platform ini mewawancarai kandidat menggunakan AI. Menilai mereka berdasarkan behavioural anchors. Lalu memberikan sebuah fit-gap report kepada recruiter."

> "Saya mau mulai dari bagaimana report ini terlihat sebelum saya perbaiki."

### 👉 Gerakkan mouse pelan ke bawah, di kolom **Required** yang kosong

**UCAPKAN:**

> "Kolom ini namanya Required. Ini level yang dibutuhkan oleh posisi tersebut. Kolomnya kosong, di semua baris."

> "Jadi ini gap report yang tidak bisa memberi tahu kita, gap-nya diukur dari mana."

### 👉 Gerakkan mouse ke baris paling bawah (tulisan Match 1, Gap 2, Exceeds 1)

**UCAPKAN:**

> "Dan ringkasan di bawah ini bilang: satu match, dua gap, satu exceeds. Totalnya empat skill. Padahal posisi ini membutuhkan tujuh skill."

> "Tiga skill sisanya tidak pernah dinilai sama sekali. Dan mereka tidak muncul di hitungan mana pun. Recruiter yang membaca ini akan mengira dia sedang melihat evaluasi yang sudah lengkap."

---

## 🎬 BAGIAN 2 — Penyebabnya (0:35 – 1:30)

### 👉 Klik **Tab 3** (GitHub, file generator.rb)

Halaman akan langsung menyorot baris 161. Kalau tidak, scroll cari tulisan `.to_i.clamp(1, 5)`.

**UCAPKAN:**

> "Awalnya saya kira ini cuma masalah tampilan. Ternyata bukan. Akar masalahnya sampai ke database."

> "Kolom `ai_level` di database itu NOT NULL, dengan batasan nilai satu sampai lima. Jadi tidak ada cara untuk menyimpan informasi: skill ini tidak kami nilai."

### 👉 Arahkan mouse ke tulisan `.to_i.clamp(1, 5)`

**UCAPKAN — pelan-pelan, ini kalimat paling penting di seluruh video:**

> "Akibatnya kodenya melakukan ini. `nil.to_i` hasilnya nol. Lalu nol dibatasi ke rentang satu sampai lima. Hasilnya jadi **satu**."

*Diam 1 detik.*

> "Dan L1 di sistem penilaian ini artinya: mengerjakan dengan arahan penuh. Belum bisa bekerja mandiri."

*Diam 1 detik.*

> "Jadi skill yang sebenarnya cuma tidak sempat ditanyakan karena waktu wawancara habis, tercatat permanen di evaluasi orang sungguhan, sebagai kelemahan yang terdokumentasi."

> "Sistemnya mengubah tidak adanya bukti, menjadi bukti ketidakmampuan."

> "Dan frontend-nya punya bug yang sama persis, secara terpisah. Fungsi `parseLevel` juga mengembalikan angka satu kalau gagal membaca nilainya. Dua lapisan berbeda sama-sama memutuskan bahwa tidak tahu berarti paling rendah."

---

## 🎬 BAGIAN 3 — Hasil perbaikannya (1:30 – 2:20)

### 👉 Klik **Tab 2** (aplikasi yang sudah diperbaiki)

**UCAPKAN:**

> "Kandidat yang sama. Data yang sama. API yang sama."

### 👉 Arahkan mouse ke kolom **Required**

**UCAPKAN:**

> "Sekarang kolom Required terisi di semua baris."

### 👉 Arahkan mouse ke kotak abu-abu di atas tabel

**UCAPKAN:**

> "Dan di atas tabel ada peringatan: tiga dari tujuh skill tidak dinilai. Ini gambaran yang belum lengkap tentang kandidat. Tidak adanya bukti, bukan berarti ada kekurangan."

### 👉 Arahkan mouse ke angka ringkasan di bawah tabel

**UCAPKAN:**

> "Hitungannya sekarang totalnya tujuh. Dan baris yang tidak dinilai warnanya abu-abu, bukan merah. Karena itu informasi yang hilang, bukan temuan negatif tentang seseorang."

### 👉 Arahkan mouse ke badge ungu bertuliskan `was L3` (baris Testing & Quality Assurance), lalu **diamkan mouse di situ 2 detik** sampai tooltip muncul

**UCAPKAN:**

> "Di baris ini, seorang assessor mengubah penilaian model dari L3 turun ke L2. Report yang lama menampilkan L2 tanpa tanda apa pun bahwa ada manusia yang mengubahnya."

> "Padahal penandanya sudah dihitung di dalam engine. Tapi dibuang sebelum dikirim ke frontend. Sementara tampilannya tetap mencetak keterangan yang menjanjikan penanda yang tidak akan pernah muncul."

### 👉 Scroll ke bawah, sampai kotak "Culture & Competency Fit"

**UCAPKAN:**

> "Narasi ini dihasilkan langsung oleh Gemini, bukan teks statis. Dan perhatikan isinya: skill-skill ini tidak dinilai, sehingga ini tidak boleh dianggap sebagai evaluasi yang lengkap."

> "Saya yang mengubah prompt-nya supaya wajib menyebutkan itu. Jadi kejujurannya tetap terjaga sampai di lapisan AI."

---

## 🎬 BAGIAN 4 — Temuan keamanan (2:20 – 3:00)

### 👉 Tetap di Tab 2. Bagian ini cukup diucapkan saja.

**UCAPKAN:**

> "Saat menelusuri controller, saya menemukan sesuatu yang jauh lebih serius."

> "Model Assessment, Session, dan Vacancy semuanya sudah dibatasi per tenant. Tapi model Portfolio tidak punya tenant id, dan tidak dibatasi sama sekali."

> "Semua pencariannya memakai global find, dengan angka yang berurutan."

> "Artinya, assessor mana pun yang sudah login bisa membaca data kandidat milik perusahaan lain. Termasuk file PDF-nya, yang isinya kutipan wawancara apa adanya."

*Diam 1 detik.*

> "Dan ada satu endpoint yang kelihatannya sudah dijaga, tapi ternyata tidak. Perintah `joins` itu tidak menambahkan filter tenant, kalau model yang di-join memang tidak dibatasi."

> "Jadi itu bukan cuma bisa dibaca. Bisa diubah. Anda bisa mengubah hasil evaluasi kandidat perusahaan lain, dan tercatat atas nama akun Anda sendiri."

> "Menurut UU PDP, itu pelanggaran pembatasan tujuan pemrosesan data pribadi. Bukan sekadar bug otorisasi."

> "Saya menambahkan sebuah concern yang mengambil tenant dari session. Saya sengaja buat explicit scope, bukan default scope. Karena background worker memang berjalan tanpa tenant, dan saya lebih memilih syaratnya terlihat jelas di setiap pemanggilan, daripada tersembunyi."

---

## 🎬 BAGIAN 5 — Pembuktian (3:00 – 4:00)

### 👉 Pindah ke **Cursor**. Klik terminal **pertama** (yang tadi dipakai `docker compose`).

Ketik perintah ini, lalu Enter:

```bash
docker compose exec -e RAILS_ENV=test api bundle exec rspec
```

Tunggu sampai selesai (sekitar 25 detik). Akan muncul `54 examples, 0 failures`.

**UCAPKAN sambil menunggu:**

> "Lima puluh empat test di backend. Waktu saya mulai mengerjakan ini, folder spec-nya tidak ada sama sekali. File konfigurasinya ada, tapi menunjuk ke tempat kosong."

### 👉 Setelah hasilnya muncul, ketik:

```bash
cd web && npm test
```

**UCAPKAN:**

> "Delapan belas test di frontend. Di sana juga sebelumnya belum ada test runner sama sekali."

*Diam 1 detik.*

> "Tapi test yang hijau itu cuma membuktikan bahwa kode melakukan apa yang dia lakukan. Jadi saya rusak sengaja, untuk membuktikan test-nya benar-benar bekerja."

### 👉 Klik **Tab 4** di Chrome (halaman commit GitHub)

**UCAPKAN:**

> "Saya kembalikan kedua bug tadi di branch terpisah, supaya bisa melihat test-nya gagal."

> "Mengembalikan bug yang pertama menghasilkan tujuh kegagalan. Nilai kosong, angka nol, dan bahkan nilai yang valid seperti L4, semuanya kembali menjadi angka satu."

> "Mengembalikan bug yang kedua menghasilkan tiga kegagalan."

> "Yang paling menarik yang ini: test-nya bilang *menemukan lebih dari satu elemen bertuliskan tanda strip*. Karena waktu bug-nya ada, kolom Required juga ikut kosong dan menampilkan strip. Jadi satu baris menampilkan dua strip sekaligus."

> "Itu sidik jari persis dari bug aslinya. Dan bisa dilihat langsung di screenshot yang saya tunjukkan di awal video tadi."

> "Bug yang saya tanam, dan proses mengembalikannya, dua-duanya tercatat di git history."

---

## 🎬 BAGIAN 6 — Yang belum selesai (4:00 – 4:30)

### 👉 Tidak perlu klik apa-apa. Cukup diucapkan.

**UCAPKAN:**

> "Ada dua hal yang sengaja tidak saya tutup."

> "Pertama. Saya memperbaiki empat model yang saya temukan tidak dibatasi per tenant. Tapi model berikutnya yang ditambahkan orang lain akan membuka lubang itu lagi. Ini butuh pengaman di level arsitektur, bukan empat tambalan. Jadi saya belum berani bilang pekerjaan ini selesai."

> "Kedua. Tabel users tidak punya tenant id. Itu tabel global yang dipakai bersama dengan API utama. Dari repository ini saja, saya tidak bisa memastikan apakah keanggotaan user ke organisasi sudah divalidasi di sisi upstream. Kalau ternyata belum, perbaikan saya ini perlu, tapi belum cukup. Itu pertanyaan yang ingin saya dapatkan jawabannya sebelum ini rilis ke production."

*Diam 1 detik.*

> "Satu hal terakhir. Migration yang saya buat menolak untuk di-rollback selama masih ada data yang belum ternilai. Dia tidak mengisinya kembali menjadi L1. Karena kalau begitu, kandidat-kandidat tadi akan dirugikan lagi secara diam-diam, saat operator mengira dia hanya melakukan rollback biasa."

> "Terima kasih."

### 👉 Klik tombol **Stop** di Loom

---

# BAGIAN C — Setelah rekaman

1. Loom otomatis membuka halaman videonya
2. Klik tombol **Share** → **Copy link**
3. Kirim link-nya ke saya, bersama link Pull Request
4. Saya masukkan ke laporan, render ulang PDF-nya
5. Anda upload PDF-nya ke portal Rakamin

---

# BAGIAN D — Kalau Ada Masalah

## Tab 2 kosong / muncul halaman login

Token-nya kadaluarsa. Di terminal Cursor, ketik:

```bash
cd D:/Project/Testing/Rakamin/ai-interview-platform
docker compose exec api bundle exec rails runner "puts JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: 'test-corp' }, 14.days)"
```

Copy hasilnya (deretan huruf panjang). Buka file `web/.env` di Cursor, ganti baris `VITE_DEV_TOKEN=` dengan token baru. Simpan. Refresh Chrome.

## Tab 2 muncul tulisan "Summary" dengan kotak kuning

Berarti Gemini-nya gagal. Video tetap bisa jalan — tapi di Bagian 3, ganti kalimat terakhir jadi:

> "Kalau panggilan ke AI gagal, sistem tidak diam. Dia memberi peringatan bahwa narasi ini dibuat otomatis dan bukan penilaian budaya kerja."

Itu justru menunjukkan penanganan error-nya bekerja.

## Halaman error / tidak bisa dibuka sama sekali

Di terminal Cursor:

```bash
cd D:/Project/Testing/Rakamin/ai-interview-platform
docker compose restart api
```

Tunggu 40 detik, refresh Chrome.

---

# BAGIAN E — Pertanyaan yang mungkin ditanya saat interview

Ini tiga keputusan yang paling mungkin dipertanyakan. Hafalkan **intinya**, jangan kata per kata.

**"Kenapa yang diubah frontend-nya, bukan API-nya?"**

> Data report yang lama sudah tersimpan di database dalam format JSONB, dan isinya memakai nama `expected_level`. Kalau saya ubah frontend-nya, semua report lama langsung ikut benar tanpa perlu migrasi data. Selain itu, PDF export-nya sudah membaca nama yang benar — kalau API-nya yang saya ubah, PDF-nya justru rusak.

**"Kenapa tidak pakai `default_scope` untuk tenant?"**

> Karena Sidekiq worker berjalan di luar request, jadi tidak ada tenant-nya. Dengan default scope, worker-nya akan diam-diam tidak melihat data apa pun. Explicit scope membuat syaratnya terlihat di tempat yang memang penting.

**"Berapa banyak yang dikerjakan AI?"**

Jawab jujur. Brief-nya memang menganjurkan pakai AI, asal diverifikasi. Contoh nyatanya:

> Ada komentar di kode yang menyatakan endpoint fit/gap mengecek override. Ternyata kodenya tidak melakukan itu. Temuannya terlihat meyakinkan, dan ternyata salah — ternyata ditangani dari sisi endpoint yang lain. Karena saya cek dulu jalur penulisannya sebelum menuliskan temuan itu, kesalahannya ketahuan sebelum masuk laporan.
