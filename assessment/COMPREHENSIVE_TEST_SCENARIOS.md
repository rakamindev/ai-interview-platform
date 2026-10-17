# Matriks Skenario Pengujian Komprehensif (End-to-End Test Scenarios)
## AI Interview & Technical Assessment Platform (Rakamin Monozukuri Standard)

Dokumen ini memuat seluruh skenario pengujian komprehensif sistem (Functional, Integration, UI/UX, Compliance UU PDP No. 27/2022, dan E2E Automation) untuk memastikan platform memenuhi seluruh standar kesiapan produksi.

---

### Ringkasan Cakauan Modul Pengujian

| Modul | Nama Modul | Jumlah Skenario | Status |
|---|---|:---:|:---:|
| **MOD-01** | Otentikasi & Multi-Tenant Authorization | 5 Skenario | PASSED |
| **MOD-02** | Manajemen Asesmen & Rubrik Taksonomi B7 | 6 Skenario | PASSED |
| **MOD-03** | Manajemen Undangan & Perutean Token Kandidat | 4 Skenario | PASSED |
| **MOD-04** | Live Session Wawancara Suara AI (Gemini Live API) | 6 Skenario | PASSED |
| **MOD-05** | Real-Time Assessor Live Session Monitor | 4 Skenario | PASSED |
| **MOD-06** | Portfolio Bukti Kompetensi & Human Override | 5 Skenario | PASSED |
| **MOD-07** | Profil Lowongan Role & Analisis Fit/Gap Otomatis | 6 Skenario | PASSED |
| **MOD-08** | Desain Sistem, Responsivitas, & Keselarasan Input | 4 Skenario | PASSED |
| **TOTAL** | **8 Modul Terintegrasi** | **40 Skenario** | **100% READY** |

---

## MOD-01: Otentikasi & Multi-Tenant Authorization

### TC-AUTH-01: Login Asesor dengan Kredensial Valid & Penerbitan JWT
- **Kategori**: Keamanan & Otentikasi
- **Prasyarat**: Server backend Rails aktif, akun asesor terdaftar di basis data tenant (`admin@rakamin.com`).
- **Langkah Pengujian**:
  1. Buka URL `/login`.
  2. Masukkan email `admin@rakamin.com` dan password `admin123`.
  3. Klik tombol `Sign in`.
- **Ekspektasi Hasil**:
  - Respon API `POST /api/v1/auth/login` mengembalikan status `200 OK` dengan payload token JWT dan info tenant (`test-corp`).
  - Token JWT tersimpan aman di `localStorage` klien.
  - Halaman diarahkan (redirect) ke `/assessments` secara mulus dengan transisi animasi Framer Motion.

### TC-AUTH-02: 1-Click Quick Demo Login untuk Evaluasi Cepat
- **Kategori**: UX & Otentikasi
- **Prasyarat**: Halaman login terbuka.
- **Langkah Pengujian**:
  1. Pada halaman `/login`, amati banner "Assessor Demo Access".
  2. Klik tombol `1-Click Sign In`.
- **Ekspektasi Hasil**:
  - Form terisi secara otomatis dan request otentikasi dikirim langsung tanpa lag.
  - Asesor langsung terotentikasi dan dialihkan ke dashboard asesmen.

### TC-AUTH-03: Multi-Tenant Tenant Scoping & Isolasi Data Antar Perusahaan
- **Kategori**: Multi-Tenancy & Keamanan Basis Data
- **Prasyarat**: Tersedia dua tenant terpisah di PostgreSQL (schema: `test-corp` dan tenant lain).
- **Langkah Pengujian**:
  1. Login sebagai asesor dari Tenant A (`test-corp`).
  2. Lakukan request list asesmen (`GET /api/v1/assessments`).
  3. Lakukan request langsung ke ID asesmen milik Tenant B.
- **Ekspektasi Hasil**:
  - Request hanya menampilkan asesmen dalam schema `test-corp`.
  - Akses cross-tenant ditolak dengan status HTTP `404 Not Found` atau `403 Forbidden`.

### TC-AUTH-04: Sign Out Asesor & Pembersihan Token
- **Kategori**: Keamanan Sesi
- **Prasyarat**: Asesor dalam keadaan login pada halaman `/assessments`.
- **Langkah Pengujian**:
  1. Klik tombol `Sign Out` pada header navigasi.
- **Ekspektasi Hasil**:
  - `localStorage` dibersihkan dari JWT token dan konteks tenant.
  - Pengguna dialihkan kembali ke halaman `/login`.
  - Percobaan navigasi kembali (browser Back button) tidak membuka halaman terlindungi.

### TC-AUTH-05: Proteksi Rute (Protected Routes) Tanpa Token
- **Kategori**: Keamanan Rute Klien
- **Prasyarat**: Klien dalam kondisi unauthenticated (belum login).
- **Langkah Pengujian**:
  1. Buka langsung URL `/assessments`, `/vacancies`, atau `/assessments/2/edit`.
- **Ekspektasi Hasil**:
  - `ProtectedRoute` mencegat akses dan mengarahkan pengguna ke `/login` dengan menyimpan intended redirect path.

---

## MOD-02: Manajemen Asesmen & Rubrik Taksonomi B7

### TC-ASM-01: Pembuatan Asesmen Baru dengan Taksonomi Standar B7
- **Kategori**: Fungsional Asesmen
- **Prasyarat**: Asesor telah login.
- **Langkah Pengujian**:
  1. Navigasi ke `/assessments/new`.
  2. Isi Judul Role: `Senior QA Analyst`.
  3. Pilih Batas Waktu Sesi: `45 menit (Standar Rakamin)`.
  4. Pilih Bahasa Wawancara AI: `English (Global Standard)`.
  5. Klik `Tambah dari Taksonomi Standar B7` dan pilih rubrik `Automation`.
  6. Klik tombol `Simpan & Lanjutkan ke Undangan`.
- **Ekspektasi Hasil**:
  - Data tersimpan via `POST /api/v1/assessments` dengan schema JSON rubrik valid.
  - Asesor diarahkan ke `/assessments/:id/invite`.

### TC-ASM-02: Kustomisasi Rubrik dengan Kriteria Anchor L1 s/d L5
- **Kategori**: Fungsional Rubrik
- **Prasyarat**: Berada pada formulir asesmen baru atau edit.
- **Langkah Pengujian**:
  1. Tambah rubrik kustom.
  2. Isi nama rubrik: `API Performance & Load Testing`.
  3. Isi `Ruang Lingkup Kompetensi (Scope Include)`.
  4. Lengkapi kriteria anchor L1 (Beginner) hingga L5 (Expert).
  5. Pilih target expected level: `L3`.
- **Ekspektasi Hasil**:
  - Seluruh field anchor tersimpan lengkap di atribut `skills` asesmen.
  - AI prompt builder menyerap kriteria L1–L5 sebagai dasar probing dan penilaian.

### TC-ASM-03: Drag-and-Drop Reorganisasi Prioritas Probing Wawancara
- **Kategori**: UI/UX & Interaksi
- **Prasyarat**: Asesmen memiliki lebih dari 1 rubrik terdaftar.
- **Langkah Pengujian**:
  1. Tarik (drag) handle titik enam di sebelah kiri card rubrik kedua ke posisi teratas.
  2. Simpan formulir.
- **Ekspektasi Hasil**:
  - Atribut `display_order` terbarui berurutan (0, 1, 2...).
  - AI Pewawancara memprioritaskan topik wawancara sesuai urutan teratas terlebih dahulu.

### TC-ASM-04: Konfigurasi Batas Waktu Sesi (Ceiling) & Bahasa Wawancara
- **Kategori**: Konfigurasi AI
- **Prasyarat**: Berada pada halaman `/assessments/:id/edit`.
- **Langkah Pengujian**:
  1. Ubah opsi batas waktu menjadi `30`, `45`, `60`, atau `90` menit.
  2. Ubah bahasa wawancara antara `English (Global Standard)` dan `Bahasa Indonesia`.
  3. Simpan perubahan.
- **Ekspektasi Hasil**:
  - Database mencatat `time_limit_min` dan `language`.
  - Sesi wawancara kandidat membatasi durasi sesuai ceiling yang ditetapkan.

### TC-ASM-05: Verifikasi Keselarasan Input & Label Form (Input Alignment)
- **Kategori**: UI/UX & Quality Assurance
- **Prasyarat**: Buka `/assessments/2/edit` dan `/assessments/new`.
- **Langkah Pengujian**:
  1. Amati field baris kedua: `BATAS WAKTU SESI (MENIT) *` (kiri) vs `BAHASA WAWANCARA AI` (kanan).
  2. Periksa posisi vertikal label, icon `Clock` vs icon `Globe`, dan ketinggian box dropdown (`h-12`).
- **Ekspektasi Hasil**:
  - Kedua label berada pada garis horizontal yang sejajar sempurna (`h-5 flex items-center gap-1.5`).
  - Kedua select trigger memiliki tinggi seragam (`h-12`) dan padding identik, tanpa offset vertikal.

### TC-ASM-06: Penghapusan Asesmen dengan Modal Konfirmasi Keamanan
- **Kategori**: Data Integrity & Safety Guard
- **Prasyarat**: Berada pada halaman edit asesmen.
- **Langkah Pengujian**:
  1. Klik tombol `Hapus Assessment` pada bagian header.
  2. Periksa dialog modal yang muncul.
  3. Uji tombol `Batal` (modal tertutup tanpa menghapus).
  4. Buka kembali dan klik `Ya, Hapus Permanen`.
- **Ekspektasi Hasil**:
  - Dialog modal konfirmasi menampilkan peringatan jelas mengenai hilangnya sesi terkait.
  - Saat dibatalkan, tidak ada request `DELETE` yang dikirim.
  - Saat dikonfirmasi, request `DELETE /api/v1/assessments/:id` berhasil dieksekusi dan pengguna dialihkan ke daftar asesmen.

---

## MOD-03: Manajemen Undangan & Perutean Token Kandidat

### TC-INV-01: Pembuatan Token Undangan Unik (Single-Use Token)
- **Kategori**: Fungsional Undangan
- **Prasyarat**: Berada pada `/assessments/:id/invite`.
- **Langkah Pengujian**:
  1. Klik tombol `Undang Kandidat`.
  2. Masukkan nama kandidat (misal: `Budi Pratama`).
  3. Klik `Generate Link →`.
- **Ekspektasi Hasil**:
  - API `POST /api/v1/assessments/:id/sessions` menghasilkan token acak 64-karakter hex aman (`SecureRandom.hex(32)`).
  - Status sesi awal tercatat sebagai `pending`.

### TC-INV-02: Redirect 301 Otomatis dari Port 3001 ke Frontend Port 5173
- **Kategori**: Network & Routing Architecture
- **Prasyarat**: Backend Rails berjalan di port 3001, frontend Vite di port 5173.
- **Langkah Pengujian**:
  1. Buka URL `http://localhost:3001/interview/:token` di browser atau via curl (`curl -I`).
- **Ekspektasi Hasil**:
  - Rails Controller merespon dengan HTTP `301 Moved Permanently` mengarah ke `http://localhost:5173/interview/:token`.
  - Kandidat tidak mengalami error 404 ketika membuka link yang disalin langsung.

### TC-INV-03: Pencegahan Penggunaan Ulang Token (Anti-Reuse Guard)
- **Kategori**: Keamanan Asesmen
- **Prasyarat**: Sesi wawancara dengan token telah berstatus `completed` atau `expired`.
- **Langkah Pengujian**:
  1. Akses kembali URL `/interview/:token` setelah wawancara selesai.
- **Ekspektasi Hasil**:
  - Sistem menolak akses masuk ke ruang wawancara audio.
  - Muncul pesan informatif: "Sesi wawancara ini telah selesai atau link telah kadaluarsa."

### TC-INV-04: Salin Link Undangan 1-Klik ke Clipboard
- **Kategori**: Interaksi UI
- **Prasyarat**: Daftar sesi kandidat terisi minimal 1 token.
- **Langkah Pengujian**:
  1. Klik tombol `Salin Link` pada baris kandidat.
- **Ekspektasi Hasil**:
  - URL frontend yang valid (`http://localhost:5173/interview/:token`) disalin ke clipboard.
  - Label tombol berubah sementara menjadi `Copied!` dengan ikon centang hijau.

---

## MOD-04: Live Session Wawancara Suara AI (Gemini Live API)

### TC-INT-01: Pre-Start Hardware Check (Mikrofon & Speaker Loopback)
- **Kategori**: Audio I/O & Browser Permissions
- **Prasyarat**: Kandidat membuka link `/interview/:token`.
- **Langkah Pengujian**:
  1. Berikan izin akses mikrofon browser saat diminta.
  2. Bicara ke mikrofon dan periksa visualisasi meter volume hijau.
  3. Klik `Uji Speaker` dan dengarkan audio chime verifikasi.
  4. Klik tombol `Mulai Sesi Wawancara AI`.
- **Ekspektasi Hasil**:
  - Hardware check memvalidasi kesiapan perangkat sebelum koneksi live dibuka.
  - Tombol mulai wawancara hanya aktif setelah audio terverifikasi.

### TC-INT-02: Koneksi WebSocket Real-Time ke Google Gemini Live API
- **Kategori**: Integrasi AI Streaming
- **Prasyarat**: GEMINI_API_KEY terkonfigurasi pada `api/config/application.yml`.
- **Langkah Pengujian**:
  1. Kandidat mengklik `Mulai Sesi Wawancara AI`.
  2. Buka DevTools Network WebSocket tab (`/cable` atau Gemini gateway).
- **Ekspektasi Hasil**:
  - WebSocket handshake sukses (status code 101 Switching Protocols).
  - AI Assessor membuka sesi percakapan dengan menyapa kandidat menggunakan suara natural dalam bahasa yang ditentukan (EN/ID).

### TC-INT-03: Audio Echo Gate & Pencegahan AI Interupsi Diri Sendiri
- **Kategori**: Audio Processing & DSP
- **Prasyarat**: Sesi wawancara audio sedang berlangsung aktif.
- **Langkah Pengujian**:
  1. Saat AI sedang berbicara (output audio aktif), amati apakah mikrofon kandidat mengirimkan gema suara AI kembali ke LLM.
- **Ekspektasi Hasil**:
  - Audio Echo Gate aktif meredam audio loopback sehingga AI tidak terinterupsi oleh pantulan suaranya sendiri.
  - Ketika kandidat berbicara dengan intensi interupsi (barge-in), AI segera menghentikan bicaranya dan mendengarkan.

### TC-INT-04: Voice Activity Detection (VAD) Silence Pump & Turn Completion
- **Kategori**: Turn-Taking Latency & Responsivitas
- **Prasyarat**: Kandidat sedang menjawab pertanyaan teknis.
- **Langkah Pengujian**:
  1. Kandidat selesai menjawab dan terdiam selama 1.5–2.0 detik.
- **Ekspektasi Hasil**:
  - VAD Silence Pump mendeteksi jeda hening dan mengirim sinyal turn completion ke Gemini Live API.
  - AI merespon balik secara alami tanpa memotong kalimat kandidat di tengah jalan.

### TC-INT-05: Ceiling Timer Sesi & Graceful Wrap-up Exit
- **Kategori**: Pengendalian Durasi Sesi
- **Prasyarat**: Sesi berjalan mendekati batas waktu `time_limit_min`.
- **Langkah Pengujian**:
  1. Monitor timer berjalan di pojok kanan atas layar wawancara.
  2. Amati perilaku sistem saat waktu tersisa 2 menit.
  3. Biarkan waktu mencapai 00:00.
- **Ekspektasi Hasil**:
  - Pada 2 menit terakhir, indikator waktu berubah warna (kuning/merah) dan AI menyampaikan kalimat penutup (wrap-up).
  - Saat waktu habis, mikrofon dinonaktifkan secara aman, data percakapan difinalisasi, dan kandidat dialihkan ke layar ucapan terima kasih.

### TC-INT-06: WebSocket Auto-Reconnection & State Recovery
- **Kategori**: Resiliensi Jaringan
- **Prasyarat**: Sesi wawancara sedang aktif.
- **Langkah Pengujian**:
  1. Putus koneksi internet selama 3 detik lalu sambungkan kembali.
- **Ekspektasi Hasil**:
  - Klien menampilkan status "Reconnecting...".
  - Sesi tersambung kembali otomatis tanpa kehilangan riwayat transkrip yang telah tercatat.

---

## MOD-05: Real-Time Assessor Live Session Monitor

### TC-MON-01: Zero-Latency WebSocket Streaming ke Layar Asesor
- **Kategori**: Monitoring Real-Time
- **Prasyarat**: Asesor membuka `/assessments/:id/sessions/:sessionId/monitor` saat kandidat sedang diwawancarai.
- **Langkah Pengujian**:
  1. Amati pembaruan transkrip di layar asesor saat kandidat dan AI berbicara.
- **Ekspektasi Hasil**:
  - Giliran bicara (turn) muncul secara langsung tanpa perlu melakukan refresh halaman browser.

### TC-MON-02: Pemetaan 4 Tingkat Coverage Rubrik Kompetensi
- **Kategori**: Visualisasi Analisis Sinyal
- **Prasyarat**: Monitor sesi aktif.
- **Langkah Pengujian**:
  1. Amati kartu rubrik kompetensi saat kandidat mendiskusikan topik tertentu.
- **Ekspektasi Hasil**:
  - State kompetensi bertransisi secara visual:
    - `0%` (Unassessed / Abu-abu)
    - `33%` (Probing Started / Kuning muda)
    - `66%` (Evidence Gathered / Teal terang)
    - `100%` (Confident Rating / Hijau tua / Emerald)

### TC-MON-03: Real-Time Speaker Differentiation (AI vs Candidate)
- **Kategori**: UX & Keterbacaan Transkrip
- **Prasyarat**: Transkrip percakapan mengalir pada monitor.
- **Langkah Pengujian**:
  1. Periksa penanda visual pembicara.
- **Ekspektasi Hasil**:
  - AI Assessor dan Candidate memiliki warna card, label avatar, dan perataan yang kontras sehingga mudah dibedakan.

### TC-MON-04: Emergency Session Termination oleh Asesor
- **Kategori**: Human Governance & Kontrol Asesor
- **Prasyarat**: Sesi sedang berjalan.
- **Langkah Pengujian**:
  1. Asesor mengklik tombol `Hentikan Sesi Segera (Emergency Stop)`.
  2. Masukkan alasan terminasi pada modal konfirmasi.
- **Ekspektasi Hasil**:
  - Sinyal broadcast terminasi terkirim via WebSocket.
  - Sesi kandidat langsung dihentikan dengan status `terminated`.

---

## MOD-06: Portfolio Bukti Kompetensi & Human Override

### TC-PORT-01: Ekstraksi Bukti Verbatim per Anchor Rubrik B7
- **Kategori**: Sintesis AI & Akurasi Bukti
- **Prasyarat**: Sesi wawancara telah selesai (`status: completed`).
- **Langkah Pengujian**:
  1. Asesor membuka halaman `/assessments/:id/sessions/:sessionId/portfolio`.
  2. Buka accordion salah satu kompetensi yang dinilai.
- **Ekspektasi Hasil**:
  - Menampilkan level penilaian AI (L1–L5).
  - Menyertakan kutipan kalimat verbatim dari transkrip yang menjadi bukti objektif penilaian.

### TC-PORT-02: Deteksi Kompetensi Tambahan (Discovered Skills)
- **Kategori**: AI Discovery Analysis
- **Prasyarat**: Kandidat mendiskusikan keahlian relevan yang tidak ada di daftar rubrik awal.
- **Langkah Pengujian**:
  1. Periksa section `Discovered Skills` pada halaman portfolio.
- **Ekspektasi Hasil**:
  - Keahlian tambahan (misal: Docker, Kubernetes, GraphQL) terdeteksi otomatis beserta konteks penggunaannya.

### TC-PORT-03: Assessor Human-in-the-Loop Override (Kepatuhan UU PDP No. 27/2022)
- **Kategori**: Compliance & Human Governance
- **Prasyarat**: Berada pada halaman portfolio kandidat.
- **Langkah Pengujian**:
  1. Klik tombol `Override` pada kartu skill yang dinilai AI L2.
  2. Ubah level menjadi `L3`.
  3. Masukkan catatan justifikasi asesor: "Kandidat menunjukkan bukti pemahaman performa query SQL tingkat lanjut pada menit ke-18."
  4. Simpan perubahan.
- **Ekspektasi Hasil**:
  - Level resmi terbarui menjadi L3 dengan badge penanda `Assessor Override`.
  - Level asli dari AI tetap tersimpan sebagai referensi audit.

### TC-PORT-04: Jejak Audit Timestamp & Identitas Penilai
- **Kategori**: Audit Trail & Governance
- **Prasyarat**: Human override telah dilakukan.
- **Langkah Pengujian**:
  1. Periksa bagian riwayat evaluasi kartu skill.
- **Ekspektasi Hasil**:
  - Menampilkan waktu modifikasi persis dan nama/email asesor yang melakukan override.

### TC-PORT-05: Ekspor Dossier Portfolio ke PDF & JSON
- **Kategori**: Export & Reporting
- **Prasyarat**: Halaman portfolio termuat lengkap.
- **Langkah Pengujian**:
  1. Klik tombol `Export PDF`.
  2. Klik tombol `JSON`.
- **Ekspektasi Hasil**:
  - Dokumen PDF rapi berstandar Rakamin berhasil di-generate dan diunduh.
  - Payload JSON terstruktur memuat seluruh metrik dan verbatim evidence.

---

## MOD-07: Profil Lowongan Role & Analisis Fit/Gap Otomatis

### TC-VAC-01: Pembuatan Profil Lowongan Role dengan Dimensi Kultur
- **Kategori**: Manajemen Lowongan
- **Prasyarat**: Asesor telah login pada `/vacancies`.
- **Langkah Pengujian**:
  1. Navigasi ke `/vacancies/new`.
  2. Isi Judul Role: `Senior QA Analyst`.
  3. Tambahkan benchmark target skill dari Taksonomi B7 beserta level minimum yang diharapkan (L3).
  4. Isi narasi `Culture Dimensions` (ownership, komunikasi transparan).
  5. Simpan formulir.
- **Ekspektasi Hasil**:
  - Lowongan tersimpan dan muncul di daftar posisi karir aktif.

### TC-VAC-02: Pencarian Cepat & Filter Kategori Fungsional
- **Kategori**: Pencarian & Filter UI
- **Prasyarat**: Terdapat beberapa lowongan dengan kategori berbeda di `/vacancies`.
- **Langkah Pengujian**:
  1. Klik filter pill `Engineering` -> Amati list lowongan.
  2. Klik filter pill `Product` -> Amati list lowongan.
  3. Ketik kata kunci `QA` di input search bar.
- **Ekspektasi Hasil**:
  - Filter kategori menyaring lowongan berdasarkan bidang fungsional tanpa mencampur aduk jenis kerja (Hybrid/Fulltime) dengan role.
  - Search bar melakukan filter fuzzy secara instan dan bebas border outline yang kasar.

### TC-VAC-03: Perhitungan Otomatis Matriks Delta Fit/Gap
- **Kategori**: Komparasi Algoritmik Multi-Model
- **Prasyarat**: Tersedia portfolio kandidat dan lowongan role benchmark.
- **Langkah Pengujian**:
  1. Buka `/assessments/:id/sessions/:sessionId/fit-gap?vacancy_id=:vacancyId`.
  2. Amati perbandingan per skill.
- **Ekspektasi Hasil**:
  - Sistem mengkategorikan setiap skill secara tepat:
    - `Match`: Capaian level kandidat == Target level lowongan.
    - `Exceed`: Capaian level kandidat > Target level lowongan.
    - `Gap`: Capaian level kandidat < Target level lowongan.
    - `Not Assessed`: Skill belum teruji dalam sesi.

### TC-VAC-04: Sintesis Narasi AI (Culture Fit & Rekomendasi Hiring)
- **Kategori**: AI Evaluator
- **Prasyarat**: Halaman laporan Fit/Gap terbuka.
- **Langkah Pengujian**:
  1. Periksa bagian `Evaluasi Budaya Kerja & Rekomendasi Asesor`.
- **Ekspektasi Hasil**:
  - LLM menghasilkan ringkasan naratif objektif mengenai kesesuaian nilai kerja kandidat terhadap culture dimensions lowongan.
  - Memberikan rekomendasi berbobot (Strong Fit, Potential Fit with Upskilling, atau Not Ready).

### TC-VAC-05: Ekspor Laporan Fit/Gap (PDF & CSV)
- **Kategori**: Pelaporan & Integrasi HR
- **Prasyarat**: Laporan Fit/Gap telah selesai dihitung.
- **Langkah Pengujian**:
  1. Klik tombol `Export PDF`.
  2. Klik tombol `CSV`.
- **Ekspektasi Hasil**:
  - File PDF berstandar eksekutif diunduh dengan ringkasan visual delta skill.
  - File CSV terunduh siap diimpor ke sistem HRIS.

### TC-VAC-06: Penghapusan Profil Lowongan dengan Dialog Konfirmasi
- **Kategori**: Data Safety
- **Prasyarat**: Berada pada `/vacancies/:id/edit`.
- **Langkah Pengujian**:
  1. Klik `Hapus Lowongan`.
  2. Konfirmasi pada modal dialog.
- **Ekspektasi Hasil**:
  - Lowongan terhapus bersih dan pengguna diarahkan kembali ke `/vacancies`.

---

## MOD-08: Desain Sistem, Responsivitas, & Keselarasan Input

### TC-UI-01: Hero Banner Kompak & Optimalisasi Ruang Vertikal
- **Kategori**: UI/UX & Layout
- **Prasyarat**: Buka seluruh halaman utama (`/assessments`, `/vacancies`, `/assessments/:id/invite`, `/interview/:token`).
- **Langkah Pengujian**:
  1. Ukur tinggi banner hero pada resolusi Desktop (1440px), Laptop (1024px), dan Mobile (375px).
- **Ekspektasi Hasil**:
  - Banner hero tampil kompak, menggunakan horizontal badge chips, dan membatasi tinggi visual sehingga formulir dan konten utama langsung terlihat tanpa perlu scroll berlebihan.

### TC-UI-02: Keselarasan Vertikal Form Input & Konsistensi Typography
- **Kategori**: Visual Polish & Alignment
- **Prasyarat**: Buka halaman edit asesmen dan formulir skill.
- **Langkah Pengujian**:
  1. Periksa jarak vertikal antar label dan input.
  2. Periksa keselarasan baris dropdown ganda (`BATAS WAKTU SESI` vs `BAHASA WAWANCARA AI`).
- **Ekspektasi Hasil**:
  - Semua label memiliki tinggi standardisasi `h-5` dengan ikon SVG vertikal sejajar.
  - Dropdown box sejajar sempurna tanpa pergeseran 1 piksel pun.
  - Tipografi seluruh antarmuka menggunakan font modern Nunito Sans yang konsisten.

### TC-UI-03: Transisi Halaman Halus & Spinner Khas Rakamin
- **Kategori**: Micro-Interactions & Animation
- **Prasyarat**: Berpindah halaman antar menu navigasi.
- **Langkah Pengujian**:
  1. Klik antar menu pada header ("Assessments" ↔ "Role Vacancies").
- **Ekspektasi Hasil**:
  - Baris animasi `PageLoader` muncul di puncak layar.
  - Pergantian konten berjalan mulus dengan animasi fade/slide Framer Motion.
  - Saat data memuat, tampil `RakaminSpinner` elegan khas brand Rakamin.

### TC-UI-04: Kepatuhan Skema Warna Brand (Primary Teal #01959f & Accent Gold #fbc036)
- **Kategori**: Brand Identity
- **Prasyarat**: Jelajahi seluruh platform.
- **Langkah Pengujian**:
  1. Periksa warna latar primary action button, badge highlight, dan state hover tombol Sign Out.
- **Ekspektasi Hasil**:
  - Tombol aksi utama menggunakan warna kuning emas Rakamin `#fbc036` (teks gelap) atau primary teal `#01959f`.
  - State hover tombol `Sign Out` menyala kuning emas `#fbc036` sesuai standar desain platform.
