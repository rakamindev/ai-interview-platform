# Problem Definition & Gap Analysis: AI Interview Platform

Dokumen ini memetakan temuan masalah nyata pada platform AI Interview berdasarkan investigasi alur aplikasi (*end-to-end user flows*), data rekaman database (*database records*), dan muatan API (*API payloads*).

---

## 1. Kerangka Klasifikasi Masalah

Temuan dikelompokkan berdasarkan dua dimensi:
1. **Tingkat Keparahan (Severity / Priority)**:
   - **P0 (Kritis)**: Menghambat fungsi inti sistem, menyebabkan *service crash*, atau menimbulkan risiko keamanan/integritas serius.
   - **P1 (Tinggi)**: Mengganggu alur kerja penting pengguna (*assessor*, *recruiter*, atau *candidate*).
   - **P2 (Sedang)**: Menurunkan kualitas, performa, atau keandalan fungsionalitas tertentu.
   - **P3 (Rendah)**: Penyempurnaan non-mendesak, perbaikan UX minor, atau pembersihan kode mati.
2. **Kategori Masalah**:
   - **Defective Implementation (DI)**: Perilaku sistem sudah ditentukan, tetapi implementasi kode salah, tidak lengkap, atau menyebabkan *runtime error*.
   - **Missing Specification (MS)**: Perilaku yang seharusnya ada belum pernah didefinisikan dalam spesifikasi atau desain produk.

---

## 2. Ringkasan Matriks Temuan

| No | ID | Masalah | Kategori | Prioritas | Komponen Terkait |
|:---:|:---:|:---|:---:|:---:|:---|
| 1 | **ISSUE-01** | EventMachine C++ Exception & WSS SSL Termination Crash | DI | **P0** | `AudioWebSocketMiddleware`, `Gemini::LiveClient` |
| 2 | **ISSUE-02** | Kegagalan Ekspor PDF akibat Inkompatibilitas Karakter Encoding | DI | **P0** | `Exports::PdfGenerator`, `PortfoliosController` |
| 3 | **ISSUE-03** | Terminasi Sesi Prematur via Endpoint Publik `/audio_complete` | DI | **P0** | `SessionsController#audio_complete` |
| 4 | **ISSUE-04** | Role Lockout pada Login Assessor (`admin` Only) | DI | **P1** | `AuthenticationController`, `AuthorizeApiRequest` |
| 5 | **ISSUE-05** | Ketiadaan Data Pengguna Awal (`User`) pada `db/seeds.rb` | MS | **P1** | `db/seeds.rb` |
| 6 | **ISSUE-06** | Pembuatan Koneksi Redis Baru Berulang (Unpooled) pada Status Update | DI | **P1** | `Sessions::StartHandler`, `Sessions::EndHandler` |
| 7 | **ISSUE-07** | Ketiadaan Automated Test Suite (Testing Blindspot) | MS | **P1** | `api/spec/`, `web/package.json` |
| 8 | **ISSUE-08** | Pemaparan Database Sequential ID ke Publik | DI | **P2** | `SessionsController#candidate_info`, WebSocket URL |
| 9 | **ISSUE-09** | Dead Code & Rute Palsu pada Registrasi Pengguna (`SignupPage`) | DI | **P2** | `SignupPage.tsx`, `api/config/routes.rb` |
| 10 | **ISSUE-10** | Puma Cluster Mode Gagal Berjalan di Lingkungan Windows | DI | **P2** | `config/puma.rb` |
| 11 | **ISSUE-11** | Persyaratan Protokol Redis 6+ Tidak Terdokumentasi | MS | **P3** | `api/README.md`, `Gemfile.lock` |
| 12 | **ISSUE-12** | Hardware Check Menggantung Tanpa Timeout/Error Guidance | MS | **P3** | `HardwareCheck.tsx` |

---

## 3. Detail Analisis Temuan

---

### ISSUE-01: EventMachine C++ Exception & WSS SSL Termination Crash
- **Prioritas**: **P0 (Kritis)**
- **Kategori**: **Defective Implementation**
- **Komponen**: `api/app/clients/gemini/live_client.rb`, `api/app/channels/audio_websocket_middleware.rb`
- **Masalah**:
  Ketika kandidat memulai sesi wawancara, backend mencoba membuka koneksi WebSocket aman (`wss://...`) ke Gemini Live API menggunakan `Faye::WebSocket::Client`. Jika lingkungan komputasi tidak memiliki pustaka OpenSSL yang di-link ke ekstensi C++ EventMachine (seperti instalasi default Windows atau container minimalis tanpa `libssl-dev`), EventMachine melempar *unhandled exception* tingkat C++:
  ```text
  terminate called after throwing an instance of 'std::runtime_error'
    what():  Encryption not available on this event-machine
  ```
  Exception ini langsung mematikan proses Rails Puma secara seketika (*abrupt crash*).
- **Bukti (Evidence)**:
  Tercatat langsung di `log/rails.log` saat sesi kandidat pertama kali terhubung. Seluruh server mati dan koneksi pengguna lain terputus.
- **Dampak (Impact)**:
  *Total Service Disruption*. Satu kandidat yang mencoba wawancara dapat merobohkan seluruh instance backend untuk seluruh asesor dan kandidat lainnya.
- **Celah Menuju Kondisi Ideal (Gap to Ideal)**:
  - **Saat ini**: Tidak ada pengecekan kapabilitas SSL EventMachine; langsung memanggil WSS dan crash jika SSL tidak tersedia.
  - **Kondisi Ideal**: Sistem melakukan validasi kesiapan SSL saat boot (`EventMachine.ssl?`). Jika gagal, koneksi ditangani secara *graceful* dengan status error yang dapat dipulihkan atau mode simulasi terisolasi, serta Dockerfile dipastikan menyertakan libssl runtime yang kompatibel.

---

### ISSUE-02: Kegagalan Ekspor PDF akibat Inkompatibilitas Karakter Encoding
- **Prioritas**: **P0 (Kritis)**
- **Kategori**: **Defective Implementation**
- **Komponen**: `api/app/services/exports/pdf_generator.rb`, `api/app/controllers/api/v1/portfolios_controller.rb`
- **Masalah**:
  Endpoint `GET /api/v1/portfolios/:id/export?format=pdf` mengalami HTTP 500 Internal Server Error saat merender laporan penilaian yang memuat karakter Unicode non-ASCII (seperti tanda panah `→` pada override, tanda bullet `•`, em-dash `—`, atau tanda petik lengkung pada kutipan bukti kandidat). Font bawaan Prawn (AFM Helvetica) hanya mendukung set karakter `Windows-1252`.
- **Bukti (Evidence)**:
  Panggilan `Exports::PdfGenerator.new.call` melempar exception:
  ```text
  Prawn::Errors::IncompatibleStringEncoding: Your document includes text that's not compatible with the Windows-1252 character set.
  ```
- **Dampak (Impact)**:
  Fitur ekspor PDF tidak dapat digunakan di lingkungan produksi ketika asesor memberikan override atau ketika kandidat mengucapkan kutipan yang mengandung tanda baca Unicode. Asesor dan hiring manager tidak dapat mencetak dokumen evaluasi resmi.
- **Celah Menuju Kondisi Ideal (Gap to Ideal)**:
  - **Saat ini**: Prawn menggunakan font standar AFM 1252 tanpa sanitasi karakter Unicode.
  - **Kondisi Ideal**: Pustaka PDF menggunakan font TrueType (TTF) yang mendukung UTF-8 penuh (misal Noto Sans / Roboto), dan teks input disanitasi secara konsisten sebelum dirender.

---

### ISSUE-03: Terminasi Sesi Prematur via Endpoint Publik `/audio_complete`
- **Prioritas**: **P0 (Kritis)**
- **Kategori**: **Defective Implementation**
- **Komponen**: `api/app/controllers/api/v1/sessions_controller.rb`
- **Masalah**:
  Endpoint `POST /api/v1/sessions/:token/audio_complete` tidak memerlukan otentikasi JWT (hanya berbekal `invite_token` pada URL). Method ini langsung memanggil:
  ```ruby
  Sessions::EndHandler.new(session).call(reason: 'all_covered')
  ```
  Tanpa memverifikasi apakah WebSocket server memang telah mengonfirmasi bahwa seluruh skill telah tuntas (`all_covered`) atau apakah audio queue benar-benar sedang di-drain.
- **Bukti (Evidence)**:
  Komentar di controller: *"No coverage re-check here. The backend WS already verified all_covered before sending preparing_to_end"*. Artinya, jika ada aktor luar yang mengetahui token link wawancara dan mengirim POST request ke endpoint tersebut, sesi langsung ditutup sepihak dengan alasan `all_covered` meskipun sesi baru dimulai.
- **Dampak (Impact)**:
  Kerentanan manipulasi alur wawancara (*interview lifecycle bypass*). Kandidat atau pihak ketiga dapat mematikan sesi wawancara sebelum waktunya dan memicu pembuatan portfolio kosong.
- **Celah Menuju Kondisi Ideal (Gap to Ideal)**:
  - **Saat ini**: Endpoint HTTP mempercayai pemanggil tanpa validasi status internal sesi.
  - **Kondisi Ideal**: Endpoint memeriksa flag state transisi yang sah (misal `session.coverage_maps.all?(&:covered?)` atau token verifikasi sekali pakai yang diterbitkan server saat `preparing_to_end`).

---

### ISSUE-04: Role Lockout pada Login Assessor (`admin` Only)
- **Prioritas**: **P1 (Tinggi)**
- **Kategori**: **Defective Implementation**
- **Komponen**: `api/app/controllers/api/v1/authentication_controller.rb`, `api/app/auth/authorize_api_request.rb`
- **Masalah**:
  Di `AuthenticationController#authenticate`, terdapat validasi:
  ```ruby
  return json_error('Invalid email or password', :unauthorized) unless user.role == 'admin'
  ```
  Padahal sistem memiliki role `assessor` dan `user`, serta helper autorisasi `AuthorizeApiRequest` secara eksplisit mendefinisikan `ASSESSOR_ROLES = %w[admin assessor]`.
- **Dampak (Impact)**:
  Pengguna dengan role `assessor` atau staf recruiter biasa tidak dapat login ke platform web. Administrator terpaksa memberikan role superadmin (`admin`) kepada semua staf yang bertugas menilai kandidat.
- **Celah Menuju Kondisi Ideal (Gap to Ideal)**:
  - **Saat ini**: Login menolak semua user yang tidak ber-role `admin`.
  - **Kondisi Ideal**: Login mengizinkan user dengan role dalam `ASSESSOR_ROLES` (`admin` dan `assessor`), dengan pembedaan hak akses menu di frontend.

---

### ISSUE-05: Ketiadaan Data Pengguna Awal (`User`) pada `db/seeds.rb`
- **Prioritas**: **P1 (Tinggi)**
- **Kategori**: **Missing Specification**
- **Komponen**: `api/db/seeds.rb`
- **Masalah**:
  File `db/seeds.rb` menginisialisasi `Organization` (Test Corp) dan 22 taksonomi skill, tetapi **tidak membuat satupun record `User`**.
- **Bukti (Evidence)**:
  Setelah menjalankan `rails db:seed` sesuai instruksi README, query database menunjukkan `User.count == 0`. Halaman login frontend `/login` gagal digunakan tanpa intervensi manual via Rails console.
- **Dampak (Impact)**:
  Instalasi lokal bagi developer baru atau *automated deployment* menghasilkan aplikasi yang tidak dapat diakses (*broken on first run*).
- **Celah Menuju Kondisi Ideal (Gap to Ideal)**:
  - **Saat ini**: Pengguna harus membuat user manual di Rails console.
  - **Kondisi Ideal**: `db/seeds.rb` memuat akun default admin (`admin@example.com` / kredensial aman) dan terdokumentasi di README.

---

### ISSUE-06: Pembuatan Koneksi Redis Baru Berulang (Unpooled) pada Status Update
- **Prioritas**: **P1 (Tinggi)**
- **Kategori**: **Defective Implementation**
- **Komponen**: `api/app/services/sessions/start_handler.rb`, `api/app/services/sessions/end_handler.rb`
- **Masalah**:
  Ketika sesi dimulai atau diakhiri, method `publish_status_update` membuka instance koneksi TCP Redis baru secara langsung:
  ```ruby
  redis = ::Redis.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'))
  redis.publish(...)
  ensure
    redis&.close
  end
  ```
  Hal ini bertolak belakang dengan `CoverageAnalyzerWorker` yang sudah menggunakan connection pool (`Sidekiq.redis { |conn| ... }`).
- **Dampak (Impact)**:
  Membuka dan menutup koneksi socket berulang kali membebani CPU, memicu *TCP connection exhaustion* pada beban tinggi, dan menyebabkan kegagalan pub/sub jika Redis berjalan di port non-standar (karena fallback URL hardcoded).
- **Celah Menuju Kondisi Ideal (Gap to Ideal)**:
  - **Saat ini**: Koneksi ad-hoc dibuat setiap kali publikasi status.
  - **Kondisi Ideal**: Menggunakan connection pool terpusat (`Sidekiq.redis` atau redis client pool yang di-share).

---

### ISSUE-07: Ketiadaan Automated Test Suite (Testing Blindspot)
- **Prioritas**: **P1 (Tinggi)**
- **Kategori**: **Missing Specification**
- **Komponen**: `api/spec/`, `web/package.json`
- **Masalah**:
  Di backend, file konfigurasi `.rspec` ada dan `Gemfile` memuat rspec/factory_bot, namun **folder `spec/` kosong/tidak ada**. Di frontend, tidak ada framework test (Vitest/Jest) dan tidak ada unit/integration test.
- **Dampak (Impact)**:
  Perubahan kode pada service vital (seperti `Coverage::StateEngine`, `SystemPromptCompiler`, atau kalkulasi fit/gap) tidak memiliki jaring pengaman otomatis (*safety net*), meningkatkan risiko *regression* saat rilis ke klien.
- **Celah Menuju Kondisi Ideal (Gap to Ideal)**:
  - **Saat ini**: 0% automated test coverage.
  - **Kondisi Ideal**: RSpec test suite mencakup unit model, state engine validation, API request contracts, dan frontend unit tests untuk komponen hardware check.

---

### ISSUE-08: Pemaparan Database Sequential ID ke Publik
- **Prioritas**: **P2 (Sedang)**
- **Kategori**: **Defective Implementation**
- **Komponen**: `api/app/controllers/api/v1/sessions_controller.rb#candidate_info`, WebSocket routing
- **Masalah**:
  Endpoint publik tanpa otentikasi `/sessions/:token/candidate` mengembalikan payload JSON berisi `session_id: 1` (integer auto-increment). Selanjutnya, kandidat diminta membuka WebSocket ke `/ws/sessions/1/audio?token=...`.
- **Dampak (Impact)**:
  *Insecure Direct Object Reference (IDOR)* / *Information Leakage*. Kandidat atau pihak luar dapat mengetahui urutan dan total volume wawancara perusahaan.
- **Celah Menuju Kondisi Ideal (Gap to Ideal)**:
  - **Saat ini**: Memadukan integer sequential ID dan hash token pada channel WebSocket.
  - **Kondisi Ideal**: URL WebSocket dan endpoint kandidat hanya menggunakan identifier acak (*UUID* atau `invite_token`).

---

### ISSUE-09: Dead Code & Rute Palsu pada Registrasi Pengguna (`SignupPage`)
- **Prioritas**: **P2 (Sedang)**
- **Kategori**: **Defective Implementation**
- **Komponen**: `web/src/pages/auth/SignupPage.tsx`, `api/config/routes.rb`
- **Masalah**:
  Frontend memiliki komponen `SignupPage.tsx` lengkap dengan form pendaftaran email, password, dan pilihan role (`admin`/`user`) yang mengirim HTTP request ke `POST /signup`. Namun, di backend Rails rute `/signup` **tidak pernah ada**, dan rute frontend `/signup` pun tidak didaftarkan di `App.tsx`.
- **Dampak (Impact)**:
  Kode mati (*dead code*) yang membingungkan pengembang dan memberikan kesan fungsionalitas yang belum tuntas (*unfinished feature*).
- **Celah Menuju Kondisi Ideal (Gap to Ideal)**:
  - **Saat ini**: Komponen ada di codebase tetapi rute tidak aktif dan API endpoint tidak ada.
  - **Kondisi Ideal**: Hapus komponen mati tersebut, atau jika pendaftaran mandiri memang direncanakan, sediakan endpoint API backend yang aman dengan validasi tenant organisasi.

---

### ISSUE-10: Puma Cluster Mode Gagal Berjalan di Lingkungan Windows
- **Prioritas**: **P2 (Sedang)**
- **Kategori**: **Defective Implementation**
- **Komponen**: `api/config/puma.rb`
- **Masalah**:
  `config/puma.rb` mendefinisikan `workers ENV.fetch('WEB_CONCURRENCY', 2)`. Di sistem operasi Windows, method `fork` tidak didukung oleh runtime Ruby, sehingga Puma langsung berhenti saat booting dengan error:
  ```text
  ERROR: worker mode not supported on ruby on this platform
  ```
- **Dampak (Impact)**:
  Pengembang lokal dengan workstation Windows tidak dapat menjalankan backend sesuai panduan README tanpa harus mencari tahu sendiri perlunya menyetel `WEB_CONCURRENCY=0`.
- **Celah Menuju Kondisi Ideal (Gap to Ideal)**:
  - **Saat ini**: Default workers disetel 2 tanpa memeriksa sistem operasi.
  - **Kondisi Ideal**: `config/puma.rb` mendeteksi platform: `workers ENV.fetch('WEB_CONCURRENCY', Gem.win_platform? ? 0 : 2)`.

---

### ISSUE-11: Persyaratan Protokol Redis 6+ Tidak Terdokumentasi
- **Prioritas**: **P3 (Rendah)**
- **Kategori**: **Missing Specification**
- **Komponen**: `api/README.md`, `Gemfile.lock`
- **Masalah**:
  `Gemfile.lock` menggunakan `sidekiq 7.3.10` dan `redis-client 0.28.0` yang secara mutlak mewajibkan Redis 6+ (perintah protokol `HELLO`). Pada server yang masih menggunakan Redis 5.0 (seperti instalasi paket Windows lawas), Sidekiq crash saat boot dengan pesan:
  ```text
  redis-client requires Redis 6+ with HELLO command available
  ```
- **Dampak (Impact)**:
  README hanya menyebutkan *"Docker (for Redis)"* tanpa menspesifikasikan versi minimum, membingungkan teknisi saat menjalankan di lingkungan on-premise/server lama.
- **Celah Menuju Kondisi Ideal (Gap to Ideal)**:
  - **Saat ini**: Versi Redis tidak dinyatakan dalam prasyarat setup.
  - **Kondisi Ideal**: Perbarui `README.md` dengan instruksi eksplisit: *"Redis 6.2+ or 7.x required"*.

---

### ISSUE-12: Hardware Check Menggantung Tanpa Timeout/Error Guidance
- **Prioritas**: **P3 (Rendah)**
- **Kategori**: **Missing Specification**
- **Komponen**: `web/src/components/HardwareCheck.tsx`
- **Masalah**:
  Jika perangkat mikrofon tidak terdeteksi atau perizinan browser ditolak tanpa melempar rejection event langsung, baris "Microphone" tetap berada dalam status `Checking...` tanpa batas waktu. Tidak ada batas waktu (timeout) 10 detik yang memunculkan pesan panduan error kepada kandidat.
- **Dampak (Impact)**:
  Kandidat mengalami kebingungan (*stuck on screen*) tanpa tombol tindakan alternatif selain merefresh halaman berulang kali.
- **Celah Menuju Kondisi Ideal (Gap to Ideal)**:
  - **Saat ini**: Menunggu promise `getUserMedia` tanpa timeout guard.
  - **Kondisi Ideal**: Terapkan timer batas 10 detik; jika stream belum tersedia, ubah state menjadi `ERROR` dan tampilkan tombol *"Troubleshoot Microphone"*.

---

## 4. Rencana Tindak Lanjut (*Action Plan*)

Berdasarkan temuan di atas, rekomendasi urutan penanganan (*remediation roadmap*) adalah:
1. **Fase 1: Kestabilan & Keamanan Kritis (P0)**:
   - Selesaikan penanganan encoding PDF di `PdfGenerator` secara permanen.
   - Pasang proteksi state validation pada endpoint `/sessions/:token/audio_complete`.
   - Tambahkan *guard condition* pada `AudioWebSocketMiddleware` dan `LiveClient` untuk menangani kegagalan koneksi SSL tanpa men-terminate server.
2. **Fase 2: Alur Inti & Pengalaman Pengguna (P1)**:
   - Perbaiki otentikasi role pada `AuthenticationController` agar assessor non-admin dapat login.
   - Tambahkan pembuatan user default pada `db/seeds.rb`.
   - Alihkan publikasi status Redis di `StartHandler` dan `EndHandler` ke connection pool.
   - Mulai membangun RSpec suite untuk logika bisnis inti.
3. **Fase 3: Penyempurnaan Platform & DX (P2 & P3)**:
   - Hapus dead code `SignupPage.tsx`.
   - Tambahkan deteksi OS pada `config/puma.rb`.
   - Sempurnakan UX error timeout pada `HardwareCheck.tsx`.
