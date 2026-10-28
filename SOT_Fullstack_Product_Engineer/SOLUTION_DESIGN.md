# Solution Design, Acceptance Criteria & Trade-offs
## Case Study: AI Interview Platform (`ai-interview-platform`)

Dokumen ini merupakan artefak resmi **Fase 3** yang memetakan rancangan solusi teknis end-to-end, evaluasi prioritas temuan, mitigasi risiko lintas tenant, kepatuhan privasi (UU PDP), strategi pengujian otomatis, serta analisis trade-off arsitektur sebelum implementasi kode dimulai pada Fase 4.

---

## 1. Ringkasan Eksekutif & Tujuan Fase 3

Berdasarkan audit komprehensif pada **Fase 2** (`AUDIT_GAP_ANALYSIS.md`), platform memiliki 8 temuan yang terbagi atas anomali alur onboarding kandidat, kegagalan penanganan error antarmuka, ketiadaan consent data biometrik, celah keamanan multi-tenant, serta ketiadaan automated test suites.

Tujuan utama dari Fase 3 adalah:
1. **Mengevaluasi dan memprioritaskan temuan GAP-01 hingga GAP-08** secara realistis berdasarkan dampak bisnis, risiko teknis, dan batasan waktu case study.
2. **Merancang Vertical Slice Utama**: *"Candidate Onboarding Resilience & Honest Failure Handling"* (mengintegrasikan perbaikan GAP-01, GAP-02, dan GAP-03 ke dalam satu solusi fullstack kohesif).
3. **Merancang Pengamanan Multi-Tenant (GAP-04)** untuk menutup celah IDOR pada ekspor dan pelaporan portofolio.
4. **Merancang Mekanisme Consent & Privacy Notice** yang selaras dengan prinsip UU PDP No. 27 Tahun 2022.
5. **Menyusun Strategi Automated Testing & Seeded Fault Test** yang dapat dieksekusi secara deterministik pada environment lokal.
6. **Menganalisis Trade-Offs Arsitektural** untuk memastikan solusi yang dipilih memiliki rasio efektivitas, keamanan, dan maintainability terbaik.

---

## 2. Evaluasi dan Prioritisasi Temuan (GAP-01 s/d GAP-08)

| ID | Masalah | Scope Case Study | Prioritas | Komponen Terdampak | Dependensi | Risiko Jika Ditunda | Target Automated Test |
|---|---|---|---|---|---|---|---|
| **GAP-01** | Port Mismatch pada Invite URL | **In Scope (Wajib)** | **P0** (Critical) | Backend (`Session#invite_url`), Config (`FRONTEND_URL`) | Tidak ada | Seluruh kandidat gagal membuka sesi via link yang dikirim asesor (404 Not Found). | RSpec: `Session#invite_url` & `SessionsController#create` |
| **GAP-02** | False Success State saat Fetch Gagal | **In Scope (Wajib)** | **P0** (Critical) | Frontend (`InterviewPage.tsx`, state machine, UI components) | GAP-01 | Kandidat tertipu mengira wawancara selesai terekam; recruiter mengira kandidat mangkir; data wawancara hilang tanpa jejak. | Vitest: `InterviewPage.test.tsx` (Error state, network retry, complete restriction) |
| **GAP-03** | Ketiadaan Privacy Notice & Consent | **In Scope (Wajib)** | **P1** (High) | Frontend (`HardwareCheck`, consent banner), Backend (`sessions` table & controller) | GAP-02 | Pelanggaran UU PDP No. 27/2022 atas transmisi data suara biometrik ke AI pihak ketiga tanpa persetujuan eksplisit. | Vitest: Mic blocked before consent; RSpec: consent payload validation |
| **GAP-04** | Cross-Tenant IDOR pada Portofolio | **In Scope (Security Patch)** | **P1** (High) | Backend (`PortfoliosController`, `PortfolioSkillsController`) | Tidak ada | Kebocoran data portofolio, transkrip, dan fit/gap report kandidat antar-organisasi yang bersaing. | RSpec: Cross-tenant access rejection (`404 / 403`) |
| **GAP-05** | Assessor Notes Opsional pada Override | *Deferred (Post-Slice)* | **P2** (Medium) | Backend (`AssessorOverride`), Frontend (`PortfolioPage`) | GAP-04 | Penurunan akuntabilitas intervensi manusia terhadap skor AI. | RSpec: `AssessorOverride` validation spec |
| **GAP-06** | Asesmen Tanpa Skill Diizinkan | *Deferred (Post-Slice)* | **P2** (Medium) | Backend (`Assessment`), Frontend (`AssessmentForm`) | Tidak ada | Prompt AI kosong dan kegagalan coverage tracking. | RSpec: `Assessment` model validation spec |
| **GAP-07** | Total Ketiadaan Automated Tests | **In Scope (Fondasi)** | **P1** (High) | Tooling & Test Suites (`spec/`, `web/src/__tests__/`) | Prasyarat Fase 4 | Tidak ada jaring pengaman regresi untuk memverifikasi bug fix secara objektif. | Eksekusi RSpec & Vitest pada CI/Lokal |
| **GAP-08** | Inkonsistensi Port di `.env.example` | **In Scope (Minor)** | **P3** (Low) | Dokumentasi (`web/.env.example`) | Tidak ada | Kebingungan onboarding developer baru. | Manual doc review |

### Justifikasi Pembagian Scope & Prioritas:
- **Vertical Slice Utama (GAP-01 + GAP-02 + GAP-03)**: Menangani jalur kritis pertama (*entry point*) interaksi manusia dengan platform. Masalah ini secara langsung merusak kredibilitas sistem di mata kandidat dan recruiter.
- **Cross-Tenant IDOR (GAP-04)**: Meskipun merupakan celah keamanan serius (P1), perbaikan backend-nya sangat terisolasi (melibatkan penambahan relasi tenant scope pada `PortfoliosController`). Oleh karena itu, GAP-04 dimasukkan sebagai *Security Hardening* bersamaan dengan pembuatan test suite di Fase 4.
- **GAP-05 & GAP-06**: Ditunda (*deferred*) ke iterasi berikutnya karena tidak memblokir alur utama wawancara kandidat dan dapat ditangani setelah fondasi onboarding stabil.

---

## 3. Desain Arsitektur Vertical Slice Utama: "Candidate Onboarding Resilience & Honest Failure Handling"

Vertical Slice ini menyelesaikan rantai kegagalan dari pembuatan link undangan oleh asesor, penerimaan oleh kandidat, validasi link, persetujuan privasi, pemeriksaan perangkat keras, hingga koneksi ke sesi AI.

```
                     ┌─────────────────────────────────────────────────────────┐
                     │                 ASSESSOR CREATES SESSION                │
                     │  POST /api/v1/assessments/:id/sessions                  │
                     │  - Generates unique invite_token                        │
                     │  - Computes invite_url using FRONTEND_URL               │
                     │    (e.g., http://localhost:5173/interview/:token)      │
                     └────────────────────────────┬────────────────────────────┘
                                                  │ (Assessor shares link)
                                                  ▼
                     ┌─────────────────────────────────────────────────────────┐
                     │                 CANDIDATE OPENS URL                     │
                     │  GET http://localhost:5173/interview/:token            │
                     └────────────────────────────┬────────────────────────────┘
                                                  │
                                                  ▼
                                      [State: INITIAL_LOADING]
                                      Fetch GET /api/v1/sessions/:token/candidate
                                                  │
                         ┌────────────────────────┴────────────────────────┐
                         │                                                 │
                   [HTTP 200 OK]                                     [HTTP Failure / Error]
                         │                                                 │
                         ▼                                                 ▼
               Check session_status                              Inspect Error Type:
         ┌───────────────┴───────────────┐               ┌─────────────────┼─────────────────┐
         │                               │               │                 │                 │
[status == 'ended']            [status == 'pending']  [404 Not Found]    [410 Expired]    [5xx / Timeout]
         │                               │               │                 │                 │
         ▼                               ▼               ▼                 ▼                 ▼
[State: COMPLETED]              [State: CONSENT_PENDING] [State: INVALID] [State: EXPIRED] [State: NET_ERROR]
Honest completion screen       Display UU PDP Notice   "Link Tidak Sah"   "Sesi Berakhir"  "Koneksi Terputus"
(Only if verified in DB)       Explicit Checkbox Req.         │                 │                 │
                                         │                    └─────────┬───────┴─────────────────┘
                                         ▼                              │
                               [Candidate Accepts]                      ▼
                                         │                         [Action: Retry]
                                         ▼                         Re-fetch token
                             [State: HARDWARE_CHECK]               (No duplicate data)
                             - Mic permission requested
                             - Echo & audio level test
                             - Upload speed test
                                         │
                                         ▼
                                   [State: READY]
                                 "Start Interview"
                                         │
                                         ▼
                                  [State: ACTIVE]
                             - Audio WS connected
                             - Live AI conversation
```

---

### 3.1 Pemisahan Konfigurasi Base URL (`FRONTEND_URL` vs `APP_BASE_URL`)

#### Akar Masalah:
Model `Session#invite_url` menggunakan `APP_BASE_URL` yang menunjuk ke backend port 3001. Padahal rute SPA `/interview/:token` hanya dilayani oleh frontend Vite pada port 5173.

#### Rancangan Solusi:
1. **Backend (`api/app/models/session.rb`)**:
   Perbarui method `invite_url` agar memprioritaskan environment variable `FRONTEND_URL` (dengan fallback yang cerdas):
   ```ruby
   def invite_url
     base = ENV['FRONTEND_URL'].presence || 
            (Rails.env.development? ? 'http://localhost:5173' : ENV.fetch('APP_BASE_URL', 'http://localhost:3001'))
     "#{base.chomp('/')}/interview/#{invite_token}"
   end
   ```
2. **Environment Configuration**:
   - `api/config/application.yml` (Figaro): Tambahkan `FRONTEND_URL: "http://localhost:5173"`.
   - `api/config/environments/production.rb`: Mewajibkan `ENV['FRONTEND_URL']` didefinisikan saat deploy.

---

### 3.2 Pembentukan, Validasi, dan Life-Cycle Invite URL

1. **Format Token**:
   - Dibuat via `SecureRandom.hex(32)` (256-bit entropy).
   - Tersimpan unik pada kolom `sessions.invite_token` dengan indeks database `idx_sessions_invite_token`.
2. **Validasi Status Sesi**:
   Saat endpoint `GET /api/v1/sessions/:token/candidate` dipanggil, backend mengevaluasi:
   - Jika token tidak ditemukan di DB $\rightarrow$ Kembalikan HTTP `404 Not Found` (`{"error": "Invalid invite token"}`).
   - Jika sesi berstatus `ended` $\rightarrow$ Kembalikan HTTP `200 OK` dengan payload `{ session_status: "ended", role_title: ..., ended_at: ... }`.
   - Jika sesi berstatus `pending` atau `active` $\rightarrow$ Kembalikan HTTP `200 OK` dengan payload `{ session_status: "pending", role_title: ..., time_limit_min: ... }`.
   - Jika sesi berstatus `failed` $\rightarrow$ Kembalikan HTTP `200 OK` dengan payload `{ session_status: "failed", error_message: ... }`.

---

### 3.3 Finite State Machine Kandidat (`InterviewPage.tsx`)

Untuk menggantikan logic ad-hoc `useState<InterviewState>` yang rapuh, dirancang Finite State Machine (FSM) terstruktur:

```typescript
export type CandidatePageState =
  | { status: "loading" }
  | { status: "invalid_token"; message: string }
  | { status: "session_expired"; endedAt?: string }
  | { status: "network_error"; message: string; retryCount: number }
  | { status: "consent_pending"; roleTitle: string; timeLimitMin: number }
  | { status: "hardware_check"; roleTitle: string; timeLimitMin: number }
  | { status: "ready"; roleTitle: string; timeLimitMin: number }
  | { status: "active"; sessionId: number }
  | { status: "complete"; endedAt?: string };
```

#### Aturan Transisi State:
1. `loading` $\rightarrow$ `consent_pending`: Ketika fetch kandidat sukses dan `session_status === 'pending'`.
2. `loading` $\rightarrow$ `complete`: **HANYA** ketika fetch kandidat sukses dan `session_status === 'ended'` dari database.
3. `loading` $\rightarrow$ `invalid_token`: Ketika API merespons HTTP `404`.
4. `loading` $\rightarrow$ `session_expired`: Ketika API merespons HTTP `410` atau `session_status === 'failed'`.
5. `loading` $\rightarrow$ `network_error`: Ketika Axios menangkap error jaringan (timeout, `ERR_CONNECTION_REFUSED`, HTTP 5xx).
6. `consent_pending` $\rightarrow$ `hardware_check`: **HANYA** setelah kandidat mencentang persetujuan pemrosesan data biometrik suara.
7. `hardware_check` $\rightarrow$ `ready`: Setelah mic, audio loopback, dan network test terpenuhi.
8. `ready` $\rightarrow$ `active`: Ketika kandidat menekan tombol "Start Interview" dan WebSocket audio berhasil dibuka.
9. `network_error` $\rightarrow$ `loading`: Ketika kandidat menekan tombol "Coba Lagi" (Retry).

> [!CRITICAL]
> **Larangan Mutlak**: Menghapus baris `.catch(() => setInterviewState("complete"))` dan melarang segala bentuk transisi ke state `complete` akibat kegagalan request jaringan atau error HTTP!

---

### 3.4 Mekanisme Retry Aman (Idempotent & No-Duplicate)

Pada kondisi gangguan jaringan (misal: Wi-Fi terputus sesaat):
- Tombol **"Coba Lagi" (Retry)** memicu pemanggilan ulang `fetchCandidateInfo(token)` menggunakan token yang sama.
- Tidak ada sesi baru yang dibuat di database (karena menggunakan method HTTP GET idempoten).
- Indikator visual menampilkan loading spinner pada tombol retry agar kandidat tidak melakukan spam klik.
- Mencegah inisialisasi ganda WebSocket dengan memastikan state koneksi sebelumnya dibersihkan (`cleanupWebSocket()`).

---

### 3.5 Privacy Notice & Persetujuan Suara (UU PDP No. 27 Tahun 2022)

Sebelum hardware check dijalankan dan sebelum mikrofon diakses, kandidat disajikan **Pemberitahuan Privasi & Persetujuan**:

#### Elemen Antarmuka Consent Banner:
1. **Identitas Pengendali & Pemroses**:
   - Pengendali Data: Organisasi Perekrut (Tenant).
   - Pemroses Pihak Ketiga: Google Gemini Live API (melalui server perantara platform).
2. **Tujuan Pemrosesan**:
   - Menganalisis kompetensi teknis berdasarkan rubrik B7 Taxonomy L1–L5.
   - Perekaman audio PCM 16kHz dan transkripsi teks wawancara.
3. **Masa Retensi & Hak Kandidat**:
   - Retensi transkrip dan laporan kompetensi selama proses rekrutmen berlangsung.
   - Hak untuk tidak melanjutkan wawancara kapan saja.
4. **Checkbox Persetujuan Eksplisit**:
   - `[ ] Saya memahami dan menyetujui perekaman suara biometrik serta analisis kompetensi oleh AI untuk keperluan seleksi kerja ini.`
   - Tombol *"Lanjutkan ke Pemeriksaan Perangkat"* dinonaktifkan (`disabled`) sampai checkbox dicentang.

#### Pencatatan di Backend (Persisted Audit Trail):
- Menambahkan endpoint: `POST /api/v1/sessions/:token/consent`.
- Menyimpan metadata ke tabel `sessions`:
  - `consented_at`: Waktu timestamp persetujuan (UTC).
  - `consent_version`: Versi dokumen privasi (contoh: `"v1.0-2026"`).

---

### 3.6 Gatekeeper Mikrofon & WebSocket (Audio Gate)

- **Frontend Gate**: Fungsi `navigator.mediaDevices.getUserMedia({ audio: true })` pada `HardwareCheck.tsx` **dilarang dipanggil** sebelum state `consent_pending` dinyatakan valid dan disetujui.
- **Backend WebSocket Gate**: Pada `AudioWebSocketMiddleware#authenticate_and_load`:
  - Jika sesi belum memiliki `consented_at` (atau belum diverifikasi persetujuannya), koneksi WebSocket ditolak dengan kode:
    ```json
    { "type": "error", "code": "consent_required", "message": "Candidate consent has not been recorded." }
    ```
  - Ini memastikan audio biometrik tidak dapat dialirkan ke Gemini tanpa bukti persetujuan legal.

---

### 3.7 Penanganan Kegagalan Sesi & Garansi Status `complete` Jujur

1. **Kegagalan saat Consent**:
   Jika pemanggilan `POST /api/v1/sessions/:token/consent` gagal (misal server error), UI menampilkan notifikasi: *"Gagal mencatat persetujuan. Silakan coba kembali."* dan tidak melanjutkan ke hardware check.
2. **Layar Selesai (*Complete Screen*)**:
   Layar selesai hanya boleh memuat pesan:
   > **Wawancara Selesai**  
   > *Terima kasih, sesi wawancara Anda telah selesai dan berhasil terekam. Tim perekrut akan meninjau hasil evaluasi Anda.*  
   Layar ini secara ketat memverifikasi bahwa `session_status === 'ended'` serta menampilkan timestamp kapan sesi berakhir (`ended_at`).

---

## 4. Desain Keamanan Multi-Tenant & Penutupan Celah IDOR (GAP-04)

### 4.1 Analisis Celah IDOR Saat Ini
Pada controller portofolio dan skill override:
- `PortfoliosController#export` memanggil `Portfolio.find(params[:id])`.
- `PortfoliosController#regenerate_fitgap` memanggil `Portfolio.find(params[:id])`.
- `PortfolioSkillsController#override` memanggil `PortfolioSkill.joins(:portfolio).find(params[:id])`.

Karena model `Portfolio` tidak memiliki kolom `tenant_id` dan tidak meng-include concern `TenantScoped`, query `Portfolio.find(id)` melakukan pencarian global across all organizations. Asesor dari Perusahaan A dapat mengunduh PDF profil kompetensi kandidat dari Perusahaan B dengan menebak integer ID portofolio.

### 4.2 Rancangan Solusi Otorisasi Tenancy

Model `Portfolio` memiliki relasi `belongs_to :session`, dan model `Session` memiliki `tenant_id` serta meng-include `TenantScoped`.

Oleh karena itu, isolasi tenant dapat ditegakkan secara kokoh tanpa perlu migrasi kolom database baru pada tabel `portfolios`:

1. **Scoping pada `PortfoliosController`**:
   ```ruby
   def set_portfolio
     if @session
       @portfolio = @session.portfolio
     else
       # Scope via relasi Session yang memiliki tenant_id aktif
       @portfolio = Portfolio.joins(:session)
                             .where(sessions: { tenant_id: current_tenant_id })
                             .find(params[:id])
     end
   rescue ActiveRecord::RecordNotFound
     json_error("Portfolio not found", :not_found)
   end
   ```
2. **Scoping pada `PortfolioSkillsController`**:
   ```ruby
   def set_portfolio_skill
     @portfolio_skill = PortfolioSkill.joins(portfolio: :session)
                                      .where(sessions: { tenant_id: current_tenant_id })
                                      .find(params[:id])
   rescue ActiveRecord::RecordNotFound
     json_error("Portfolio skill not found", :not_found)
   end
   ```

### 4.3 Rencana Pengujian Isolasi Tenant
Membuat request spec RSpec dengan 2 tenant sintetis:
- **Tenant 1**: `Org A` (`scheme: "org-alpha"`), memiliki User Assessor A, Assessment A, Session A, dan Portfolio A.
- **Tenant 2**: `Org B` (`scheme: "org-beta"`), memiliki User Assessor B, Assessment B, Session B, dan Portfolio B.
- **Skenario Uji**:
  - Assessor A mencoba `GET /api/v1/portfolios/:id/export` milik Portfolio B $\rightarrow$ Ekspektasi: `HTTP 404 Not Found` (mencegah enumerasi ID) atau `403 Forbidden`.
  - Assessor A mencoba `POST /api/v1/portfolio_skills/:id/override` milik Skill B $\rightarrow$ Ekspektasi: `HTTP 404 Not Found`.

---

## 5. Desain Teknis Kepatuhan Privasi Data (UU PDP No. 27/2022)

### 5.1 Prinsip Pemrosesan Data Pribadi
Sesuai UU Perlindungan Data Pribadi (UU No. 27 Tahun 2022), data suara rekaman wawancara dan transkrip performa kerja termasuk dalam kategori data pribadi yang diproses untuk tujuan spesifik (*purpose limitation*):

1. **Legal Basis**: Persetujuan eksplisit yang sah (*explicit consent*) dari subjek data (kandidat).
2. **Transparansi**: Kandidat diberitahu mengenai identitas Pengendali Data (perusahaan pengguna) dan Pemroses Pihak Ketiga (Google Cloud Gemini API).
3. **Penyimpanan & Retensi**: Data audio stream hanya diolah sementara (*ephemeral streaming buffer* 16kHz $\rightarrow$ 24kHz) dan transkrip disimpan untuk keperluan penilaian kompetensi selama siklus asesmen aktif.
4. **Sanitasi Log**: Server Rails dan WebSocket middleware dilarang mencatat raw audio chunks ke log file, serta dilarang mencetak invite token di query params yang tidak terenkripsi.

### 5.2 Batasan Hukum
> [!NOTE]
> Desain teknis ini dirancang untuk memenuhi persyaratan fungsional *informed consent* dan *data protection by design*. Dokumen ini tidak menyatakan kesimpulan kepatuhan hukum final yang menggantikan nasihat legal resmi atau audit kepatuhan korporat.

---

## 6. Strategi Automated Testing

Repository awal tidak memiliki automated test suite sama sekali. Untuk memastikan perbaikan stabil dan bebas regresi, dirancang strategi pengujian terpadu:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AUTOMATED TESTING HARNESS                       │
├───────────────────────────────────┬────────────────────────────────────┤
│           BACKEND (RSpec 6)       │          FRONTEND (Vitest)         │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Model Specs:                    │ • Component Specs:                 │
│   - Session#invite_url resolution │   - State Machine rendering        │
│   - Session token generation      │   - Consent banner checkbox        │
│ • Request Specs:                  │   - Error states (404, 500, retry) │
│   - Candidate Info endpoint       │ • Integration Tests:               │
│   - Consent endpoint (POST)       │   - Mock Axios failure handling    │
│   - Cross-Tenant IDOR protection  │   - Audio capture gating           │
├───────────────────────────────────┴────────────────────────────────────┤
│                         SEEDED FAULT TEST                              │
│ Intentionally inject `.catch(() => setInterviewState("complete"))`     │
│ and prove that `InterviewPage.test.tsx` FAILS immediately.             │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.1 Backend Testing (RSpec)
- **Framework**: `rspec-rails` 6.0 (sudah ada dalam `api/Gemfile`), didukung oleh `factory_bot_rails` dan database cleaner.
- **Struktur File**:
  - `api/spec/models/session_spec.rb`: Memverifikasi format `invite_url` menggunakan `FRONTEND_URL` dan keunikan `invite_token`.
  - `api/spec/requests/api/v1/sessions_candidate_spec.rb`: Menguji endpoint `GET /sessions/:token/candidate` untuk token valid, token invalid (404), dan sesi ended.
  - `api/spec/requests/api/v1/portfolios_tenant_spec.rb`: Menguji isolasi tenant dan penolakan akses lintas tenant pada endpoint export.
- **Cara Eksekusi**:
  ```powershell
  bundle exec rspec
  ```

### 6.2 Frontend Testing (Vitest & React Testing Library)
- **Framework**: `vitest` + `@testing-library/react` + `jsdom`.
- **Alasan Pemilihan**: Vitest kompatibel langsung secara native dengan konfigurasi Vite 6 (`vite.config.ts`), tanpa perlu transpilasi Babel tambahan.
- **Struktur File**:
  - `web/src/__tests__/InterviewPage.test.tsx`:
    - Menguji render awal menampilkan loading state.
    - Menguji respons 404 menampilkan UI *"Link Wawancara Tidak Ditemukan"* (bukan *Complete*).
    - Menguji respons error jaringan menampilkan tombol *"Coba Lagi"* dan trigger re-fetch.
    - Menguji bahwa status *Complete* HANYA tampil jika backend mengirim `session_status: "ended"`.
  - `web/src/__tests__/ConsentFlow.test.tsx`:
    - Menguji tombol *"Lanjutkan ke Pemeriksaan Perangkat"* dinonaktifkan sebelum checkbox persetujuan dicentang.
- **Cara Eksekusi**:
  ```powershell
  npm.cmd test
  ```

### 6.3 Seeded Fault Test (Bukti Jaring Pengaman Regresi)
Sebagai bagian dari kriteria case study, satu pengujian kegagalan yang disengaja (*seeded fault*) akan dijalankan:
1. **Injeksi Bug**: Kode `InterviewPage.tsx` sengaja diubah kembali ke bentuk lama: `.catch(() => setInterviewState("complete"))`.
2. **Eksekusi Test**: Menjalankan `npm.cmd test`.
3. **Hasil yang Diharapkan**: Test runner **GAGAL** dengan pesan error eksplisit:  
   `AssertionError: expected 'Interview Complete' not to be in document, but found it when API returns 404`.
4. **Pemulihan**: Mengembalikan kode yang benar dan membuktikan test kembali hijau (**PASS**).

---

## 7. Analisis Trade-Offs & Keputusan Arsitektur

Berikut adalah perbandingan alternatif arsitektur untuk tiga keputusan teknis penting:

### Keputusan 1: Konfigurasi URL Frontend vs Backend

| Dimensi | Opsi A: Environment Variable `FRONTEND_URL` (Dipilih) | Opsi B: Reverse Proxy / Unified Origin Routing |
|---|---|---|
| **Mekanisme** | Rails membaca `ENV['FRONTEND_URL']` (misal port 5173 di dev, domain web di prod). | Mengonfigurasi Nginx/Caddy di depan Rails & Vite sehingga keduanya berada di origin yang sama (`/api` vs `/`). |
| **Keamanan** | Aman; CORS tetap terkonfigurasi via `Rack::Cors`. | Sangat aman; bebas CORS karena same-origin. |
| **Kompleksitas** | **Rendah**: Hanya butuh 1 env var dan 5 baris kode di model `Session`. | **Tinggi**: Membutuhkan setup web server/proxy tambahan di Windows dev environment. |
| **Waktu Pengerjaan** | **15 menit**. | **2-3 jam**. |
| **Maintainability** | Tinggi; standar industri untuk arsitektur Decoupled SPA + API. | Sedang; menambah ketergantungan konfigurasi proxy lokal. |
| **Keputusan** | **PILIH OPSI A**: Memberikan solusi instan, bersih, dan sesuai standar Rails API tanpa beban dependensi proxy. |

---

### Keputusan 2: Mekanisme Audit dan Validasi Consent

| Dimensi | Opsi A: Client-Side Gate Saja | Opsi B: Server-Side Persisted Audit + WS Gate (Dipilih) |
|---|---|---|
| **Mekanisme** | Checkbox di UI mengatur local state React sebelum mic dibuka; tidak disimpan di DB. | Checkbox di UI memanggil API consent; database menyimpan `consented_at`; WebSocket middleware memvalidasi. |
| **Keamanan** | Rendah; rentan di-bypass dengan inspect/script jika WS langsung dipanggil. | **Tinggi**: Audio stream ditolak di tingkat server jika tidak ada record consent. |
| **Kompleksitas** | Sangat rendah. | Sedang (butuh migrasi kolom `consented_at` dan endpoint API). |
| **Kepatuhan UU PDP** | Lemah; tidak ada audit trail jika terjadi sengketa hukum atau audit data. | **Kuat**: Memiliki bukti timestamp waktu persetujuan yang dapat diaudit. |
| **Keputusan** | **PILIH OPSI B**: Perlindungan data pribadi yang kredibel memerlukan verifikasi sisi server (*defense in depth*). |

---

### Keputusan 3: Penutupan Celah Multi-Tenant IDOR (GAP-04)

| Dimensi | Opsi A: Tambah Kolom `tenant_id` pada Tabel `portfolios` | Opsi B: Scope Melalui Relasi `joins(:session)` (Dipilih) |
|---|---|---|
| **Mekanisme** | Menjalankan migrasi `add_column :portfolios, :tenant_id`, backfill data, dan include `TenantScoped`. | Memanfaatkan relasi `portfolios.session_id` $\rightarrow$ `sessions.tenant_id` pada query controller. |
| **Keamanan** | Sangat tinggi (otomatis via default scope). | **Sangat tinggi** (akses terisolasi per tenant aktif). |
| **Kompleksitas** | Sedang (perlu migrasi, backfill relasi lama, dan update model). | **Rendah** (cukup 4 baris kode di controller). |
| **Waktu Pengerjaan** | 45 menit. | **15 menit**. |
| **Risiko Regresi** | Sedang (berpotensi mengunci record portofolio lama jika backfill gagal). | **Nol** (tidak mengubah skema database fisik portofolio). |
| **Keputusan** | **PILIH OPSI B**: Menggunakan scoping relasional `Portfolio.joins(:session).where(sessions: { tenant_id: current_tenant_id })`. Cepat, aman, dan tanpa risiko kerusakan skema. |

---

## 8. Rencana Implementasi & Manajemen Perubahan

### 8.1 Daftar Perubahan Wajib (Must Have for Slice)
1. **Backend**:
   - Tambah konfigurasi `FRONTEND_URL` pada `Session#invite_url`.
   - Migrasi database: Tambahkan `consented_at` (datetime) dan `consent_version` (string) pada tabel `sessions`.
   - Endpoint `POST /api/v1/sessions/:token/consent` untuk mencatat persetujuan kandidat.
   - Perbaiki `candidate_info` agar menyertakan status consent dan detail sesi yang relevan.
   - Proteksi IDOR pada `PortfoliosController` dan `PortfolioSkillsController`.
   - Validasi consent pada `AudioWebSocketMiddleware`.
2. **Frontend**:
   - Rombak state machine pada `InterviewPage.tsx` menjadi FSM terstruktur.
   - Komponen UI untuk `Loading`, `InvalidToken`, `SessionExpired`, dan `NetworkError` dengan tombol `Retry`.
   - Komponen `PrivacyConsentBanner` yang memblokir aktivasi mikrofon sebelum disetujui.
   - Hubungkan callback retry tanpa memicu duplicate requests.
3. **Automated Testing**:
   - Setup RSpec di backend + unit & request specs.
   - Setup Vitest di frontend + component & error handling tests.
   - Eksekusi Seeded Fault Test.

### 8.2 Daftar Perubahan yang Ditunda (Deferred to Post-Slice)
- **GAP-05**: Validasi `presence: true` untuk `assessor_notes` di model `AssessorOverride`.
- **GAP-06**: Validasi minimal 3 skill di model `Assessment`.
- **GAP-08**: Pembaruan komentar port pada `web/.env.example`.

### 8.3 Rencana Migrasi Database & Strategi Rollback
- **Nama Migrasi**: `AddConsentTrackingToSessions`
  ```ruby
  class AddConsentTrackingToSessions < ActiveRecord::Migration[7.0]
    def change
      add_column :sessions, :consented_at, :datetime
      add_column :sessions, :consent_version, :string, limit: 20
    end
  end
  ```
- **Kompatibilitas**: Kolom bersifat `nullable` (`null: true`), sehingga data sesi yang sudah ada di database (`rakamin_development`) tidak rusak dan tidak membutuhkan data backfill yang rumit.
- **Rollback Strategy**:
  ```bash
  bundle exec rails db:rollback STEP=1
  ```

### 8.4 Urutan Eksekusi Bertahap (TDD Workflow)

```
Langkah 1: SETUP TEST HARNESS (RSpec di api/, Vitest di web/)
    │
    ▼
Langkah 2: TULIS FAILING SPECS (RED)
    - Spec untuk invite_url dan candidate endpoint
    - Spec untuk penolakan cross-tenant IDOR
    - Test untuk Candidate Error State Machine & Consent
    │
    ▼
Langkah 3: IMPLEMENTASI BACKEND (GREEN)
    - Migrasi consent tracking
    - Update Session#invite_url
    - Update PortfoliosController tenant scoping
    - Update AudioWebSocketMiddleware consent validation
    │
    ▼
Langkah 4: IMPLEMENTASI FRONTEND (GREEN)
    - Refactor InterviewPage.tsx ke FSM
    - Implementasi Privacy & Consent UI
    - Implementasi Error States & Retry UI
    │
    ▼
Langkah 5: VERIFIKASI SEMUA TEST LULUS (GREEN)
    - bundle exec rspec (100% pass)
    - npm.cmd test (100% pass)
    │
    ▼
Langkah 6: SEEDED FAULT TEST
    - Rusak kode secara terkontrol -> Buktikan test GAGAL -> Pulihkan kode -> Buktikan test LULUS.
```

---

## 9. Acceptance Criteria Final (Kriteria Keberhasilan Gate 3)

Berikut adalah daftar Acceptance Criteria terukur yang akan dijadikan tolok ukur pengujian pada Fase 4 dan 5:

### AC-01: Resolusi & Validasi URL Undangan Kandidat
- [ ] `Session#invite_url` menghasilkan URL yang mengarah ke port frontend (`http://localhost:5173/interview/:token` di dev).
- [ ] Mengklik "Copy link" pada `AssessmentInvitePage` menyalin link frontend yang valid ke clipboard.
- [ ] Membuka link undangan yang valid di browser langsung memuat halaman wawancara kandidat tanpa error 404 RoutingError di Rails.

### AC-02: Kejujuran Penanganan Error & State Machine Antarmuka
- [ ] Jika kandidat membuka URL dengan token tidak dikenal, sistem menampilkan pesan error *"Link Wawancara Tidak Ditemukan"* (bukan status *Interview Complete*).
- [ ] Jika koneksi API mati atau request timeout, sistem menampilkan pesan *"Koneksi Terputus"* disertai tombol *"Coba Lagi"*.
- [ ] Menekan tombol *"Coba Lagi"* memicu re-fetch data tanpa membuat sesi baru atau menggandakan state.
- [ ] Layar *"Interview Complete"* **HANYA** muncul jika respons API mengembalikan `session_status === 'ended'` yang sah dari database.

### AC-03: Kepatuhan Privasi Data & Gating Mikrofon (UU PDP)
- [ ] Halaman onboarding menampilkan ringkasan tujuan pengumpulan audio, pemrosesan oleh AI Google Gemini, dan identitas pengendali data.
- [ ] Perangkat mikrofon **TIDAK DIAKSES** (`getUserMedia` tidak dipanggil) sebelum kandidat mencentang checkbox persetujuan.
- [ ] Persetujuan kandidat dicatat di backend (`consented_at` tersimpan di database).
- [ ] WebSocket audio menolak streaming jika persetujuan belum tercatat.

### AC-04: Isolasi Keamanan Multi-Tenant (IDOR Patch)
- [ ] Pengguna dari Tenant A tidak dapat mengakses atau mengunduh portofolio milik Tenant B via `GET /api/v1/portfolios/:id/export` (mengembalikan HTTP 404).
- [ ] Pengguna dari Tenant A tidak dapat mengubah nilai skill milik Tenant B via `POST /api/v1/portfolio_skills/:id/override` (mengembalikan HTTP 404).

### AC-05: Jaminan Mutu Pengujian Otomatis & Seeded Fault
- [ ] Seluruh unit/request specs backend (RSpec) berjalan dan lulus 100%.
- [ ] Seluruh unit/component tests frontend (Vitest) berjalan dan lulus 100%.
- [ ] Seeded Fault Test membuktikan bahwa mengembalikan bug `.catch(() => setInterviewState("complete"))` menggagalkan test runner secara deterministik.
