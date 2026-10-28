# End-to-End Audit & Gap Analysis
## Case Study: AI Interview Platform (`ai-interview-platform`)

Dokumen ini menyajikan hasil audit end-to-end terhadap implementasi aktual kode backend (Ruby on Rails 7), frontend (React 18 + Vite), database (PostgreSQL 18.6), background worker (Sidekiq + Redis 8), serta pipeline integrasi AI (Gemini Live & Flash).

---

## 1. Ringkasan Eksekutif

Audit dilakukan secara langsung pada service yang berjalan operasional di lingkungan pengembangan lokal. Dari pengujian end-to-end yang menghubungkan antarmuka web, API REST, WebSocket middleware, database schema, dan integrasi worker, ditemukan **8 temuan terverifikasi**:

- **2 Temuan P0 (Critical)**:
  1. *Candidate Invite URL Routing Disorientation*: Link undangan kandidat yang diterbitkan sistem mengarah ke port Rails (3001) yang menghasilkan HTTP 404, memutus alur akses kandidat.
  2. *False Success State on Candidate Fetch Failure*: Kegagalan pemuatan sesi kandidat memicu layar sukses palsu (*Interview Complete*), membuat kandidat tertipu mengira wawancara telah selesai dan terekam padahal tidak ada data yang masuk.
- **3 Temuan P1 (High)**:
  1. *Absence of Privacy Notice & Consent Tracking*: Ketiadaan pemberitahuan privasi, dasar hukum pemrosesan data suara biometrik, dan pencatatan persetujuan (UU PDP No. 27 Tahun 2022).
  2. *Cross-Tenant IDOR on Portfolio Export*: Endpoint ekspor dan regenerasi portofolio tidak memvalidasi tenant ownership, membuka celah akses data kandidat antar-organisasi.
  3. *Total Absence of Automated Regression Tests*: Ketiadaan test suite di `api/` dan `web/` yang membahayakan stabilitas rilis produk.
- **2 Temuan P2 (Medium)**: Ketiadaan kewajiban catatan alasan pada *Assessor Override* dan ketiadaan validasi batas minimal skill pada pembuatan asesmen.
- **1 Temuan P3 (Low)**: Inkonsistensi dokumentasi port default pada `web/.env.example`.

Semua temuan di bawah didukung oleh bukti kode, eksekusi HTTP request nyata, dan tangkapan layar browser.

---

## 2. Peta Komponen dan Alur yang Telah Diaudit

```
[Browser / Assessor UI] (Port 5173)
       │
       ├─► GET /api/v1/assessments ──────────► [AssessmentsController] ──► [(assessments, skills)]
       ├─► POST /api/v1/assessments/:id/sessions ► [SessionsController] ─► [(sessions: invite_token)]
       │                                                                           │
       │   (URL Dihasilkan: http://localhost:3001/interview/:token)                │
       │   [GAP: Mengarah ke Rails API bukan Web Frontend]                         ▼
       │
[Browser / Candidate UI] (Port 5173) ◄──────────────────────────────────────────────┘
       │
       ├─► GET /api/v1/sessions/:token/candidate ──► [SessionsController#candidate_info]
       │   [GAP: Jika 404/Error, UI memicu State 'complete' palsu!]
       │
       ├─► Hardware Check (Mic/Audio/Camera/Speed)
       │   [GAP: Tidak ada Consent Banner / Kebijakan Privasi UU PDP]
       │
       ├─► WS /ws/sessions/:id/audio?token=... ───► [AudioWebSocketMiddleware]
       │                                                    │
       │                                                    ├──► [Gemini Live API]
       │                                                    ├──► [(transcript_turns)]
       │                                                    └──► [CoverageAnalyzerWorker] (N7)
       │
[Review & Fit/Gap Workflow]
       │
       ├─► POST /api/v1/portfolio_skills/:id/override ► [PortfolioSkillsController]
       │   [GAP: Assessor Notes bersifat opsional tanpa audit trail]
       │
       └─► GET /api/v1/portfolios/:id/export ────────► [PortfoliosController#export]
           [GAP: Tidak ada pengecekan tenant_id pada model Portfolio (IDOR)]
```

---

## 3. Matriks Temuan dan Bukti Terverifikasi

| ID | Komponen & Lokasi | Jenis Masalah | Severity | Keyakinan | Ringkasan Masalah |
|---|---|---|---|---|---|
| **GAP-01** | `api/app/models/session.rb:28-31` | Defective Implementation | **P0** | Terverifikasi | `invite_url` mengarah ke host API (port 3001) yang menghasilkan HTTP 404 saat dibuka kandidat. |
| **GAP-02** | `web/src/pages/interview/InterviewPage.tsx:51` | Defective Implementation | **P0** | Terverifikasi | Kegagalan request `getCandidateInfo` ditangkap `.catch(() => setInterviewState("complete"))`, menampilkan status sukses palsu. |
| **GAP-03** | `web/src/pages/interview/InterviewPage.tsx`, `api/db/schema.rb` | Missing Specification | **P1** | Terverifikasi | Ketiadaan Privacy Notice, Consent banner, pencatatan persetujuan, dan batas retensi data suara (UU PDP). |
| **GAP-04** | `api/app/controllers/api/v1/portfolios_controller.rb:156` | Defective Implementation | **P1** | Terverifikasi | Model `Portfolio` tidak memiliki `TenantScoped`; endpoint `export` rentan akses IDOR lintas tenant. |
| **GAP-05** | `api/app/models/assessor_override.rb:3-9` | Missing Specification | **P2** | Terverifikasi | `assessor_notes` tidak divalidasi `presence: true`, memungkinkan intervensi manusia tanpa justifikasi tertulis. |
| **GAP-06** | `api/app/models/assessment.rb` | Missing Specification | **P2** | Terverifikasi | Asesmen dapat disimpan tanpa skill terdaftar, merusak pipeline AI prompt compiler dan coverage tracking. |
| **GAP-07** | `api/`, `web/` | Missing Infrastructure | **P1** | Terverifikasi | Ketiadaan automated test suite (RSpec / Vitest) di seluruh codebase. |
| **GAP-08** | `web/.env.example` | Defective Documentation | **P3** | Terverifikasi | Port default `VITE_API_BASE_URL` merujuk ke 3000, bukan 3001. |

---

## 4. Hasil Verifikasi Tiga Anomali dari Fase 1

### A. Anomali 1: Disorientasi URL Undangan Kandidat (GAP-01)
- **File**: [api/app/models/session.rb:28-31](file:///a:/ai-interview-platform/api/app/models/session.rb#L28-L31)
- **Kode Aktual**:
  ```ruby
  def invite_url
    base = ENV.fetch('APP_BASE_URL', 'http://localhost:3001')
    "#{base}/interview/#{invite_token}"
  end
  ```
- **Bukti Pengujian Nyata**:
  Eksekusi HTTP GET ke `http://localhost:3001/interview/41064313b4dd8cc6de2bd34b0df5263174ab7e99ab874e38a1a5489b8639a889` menghasilkan respons:
  ```text
  HTTP/1.1 404 Not Found
  ActionController::RoutingError: No route matches [GET] "/interview/41064313b4dd8cc6de2bd34b0df5263174ab7e99ab874e38a1a5489b8639a889"
  ```
- **Akar Masalah**: Nilai `APP_BASE_URL` dikonfigurasi menunjuk ke server Rails backend, padahal rute SPA React `/interview/:token` dilayani oleh frontend web server.
- **Perilaku yang Diharapkan**: Sistem harus memisahkan konfigurasi URL backend (`APP_BASE_URL`) dan URL frontend (`FRONTEND_URL` / `WEB_BASE_URL`). Method `invite_url` harus menggunakan base URL frontend (misal `http://localhost:5173`).

---

### B. Anomali 2: Silent Failure & Status Sukses Palsu pada Rute Kandidat (GAP-02)
- **File**: [web/src/pages/interview/InterviewPage.tsx:43-53, 230-242](file:///a:/ai-interview-platform/web/src/pages/interview/InterviewPage.tsx#L43-L53)
- **Kode Aktual**:
  ```typescript
  useEffect(() => {
    if (!token) return;
    sessionsApi.getCandidateInfo(token)
      .then((res) => {
        setCandidateInfo(res.data);
        setSessionId(res.data.session_id);
        if (res.data.session_status === "ended") setInterviewState("complete");
      })
      .catch(() => setInterviewState("complete")); // <-- BUG UTAMA
  }, [token]);
  ```
- **Bukti Pengujian Nyata**:
  Ketika browser subagent membuka URL dengan token invalid `http://localhost:5173/interview/invalid-token-xyz`, API mengembalikan 404. Axios menangkap error tersebut dan langsung mengeksekusi `.catch()`. Antarmuka langsung menampilkan:
  > **✅ Interview Complete**  
  > *Thank you. The interview has been recorded. The hiring team will review your results and follow up with you.*  
  *(Tangkapan layar tersimpan pada [offline_interview_page_1792865952300.png](file:///C:/Users/Engineer/.gemini/antigravity-ide/brain/8c17ca2b-5c2a-40c7-b97e-13884229d0bd/offline_interview_page_1792865952300.png)).*
- **Akar Masalah**: Penanganan error tidak membedakan antara status *sesi yang memang sudah selesai* dengan *kegagalan memuat data* (koneksi putus, API down, token invalid, token expired).
- **Dampak Produk**: Menghancurkan kepercayaan kandidat terhadap institusi perekrut, menyebabkan kandidat kehilangan kesempatan wawancara tanpa menyadari adanya error teknis.
- **Perilaku yang Diharapkan**: Jika pemanggilan API gagal, antarmuka harus masuk ke state error (`error` state) dengan pesan yang jelas (misal: *"Unable to load interview session. Please check your link or network connection"*), disertai tombol *Try Again / Refresh*.

---

### C. Anomali 3: Ketiadaan Privacy Notice dan Persetujuan Data Suara (GAP-03)
- **File**: [web/src/pages/interview/InterviewPage.tsx:204-210](file:///a:/ai-interview-platform/web/src/pages/interview/InterviewPage.tsx#L204-L210), [web/src/components/HardwareCheck.tsx](file:///a:/ai-interview-platform/web/src/components/HardwareCheck.tsx)
- **Kode Aktual**:
  Halaman onboarding hanya menampilkan instruksi ruang hening:
  ```text
  • This is a voice interview. Make sure you're in a quiet place.
  • The AI will ask follow-up questions — there are no scripts.
  • The session will last up to 30 minutes.
  • Your mic will be active throughout. You can end anytime.
  ```
- **Bukti Temuan**:
  1. Tidak ada penjelasan mengenai pihak pengolah data (AI interviewer pihak ketiga, model Google Gemini).
  2. Tidak ada tautan Kebijakan Privasi atau klausul persetujuan pemrosesan data biometrik suara.
  3. Tidak ada checkbox atau tombol eksplisit *Persetujuan Pemrosesan Data Pribadi*.
  4. Database `sessions` tidak menyimpan atribut waktu persetujuan (`consented_at`), alamat IP, atau versi kebijakan privasi yang disetujui.
- **Akar Masalah**: Kebutuhan kepatuhan hukum privasi data (UU PDP No. 27/2022) belum diterjemahkan ke dalam spesifikasi antarmuka dan skema penyimpanan.
- **Perilaku yang Diharapkan**: Kandidat wajib disajikan informasi ringkas mengenai tujuan pengumpulan suara dan diwajibkan memberikan persetujuan eksplisit (*informed consent*) sebelum mikrofon diaktifkan dan sesi WebSocket dimulai.

---

## 5. Gap antara Implementasi Aktual dan Kebutuhan Produk

| Aspek Produk | Kondisi Ideal (PRD & Brief) | Kondisi Aktual Repository | Kesenjangan (Gap) |
|---|---|---|---|
| **Alur Undangan** | Asesor membagikan link yang langsung membuka portal wawancara kandidat. | Link mengarah ke port 3001 (API) dan menghasilkan 404 Routing Error. | **Disorientasi Port / Host**: Kandidat tidak dapat membuka wawancara melalui link yang disalin asesor. |
| **Transparansi Kegagalan** | Error jaringan atau token salah menampilkan pesan error dan opsi pemulihan. | Menampilkan layar "Interview Complete" seolah-olah wawancara sukses terekam. | **Deceptive Failure Mode**: Kandidat mengira sudah selesai padahal data tidak pernah terekam. |
| **Perlindungan Data Pribadi** | Sesuai UU PDP: consent eksplisit, purpose limitation, dan retensi data. | Langsung meminta izin mic tanpa consent banner atau kebijakan data. | **Risiko Hukum & Kepatuhan**: Pemrosesan data biometrik suara tanpa persetujuan eksplisit. |
| **Isolasi Multi-Tenant** | Data portofolio kandidat terisolasi ketat per organisasi. | Endpoint `export` dan `regenerate_fitgap` dapat diakses lintas tenant via IDOR. | **Celah Keamanan Tenant**: Potensi kebocoran profil kompetensi antar perusahaan. |
| **Integritas Penilaian Manusia** | Assessor override harus memiliki justifikasi tertulis agar transparan dan dapat diaudit. | `assessor_notes` opsional di model `AssessorOverride`. | **Kurangnya Akuntabilitas**: Koreksi nilai AI dapat dilakukan tanpa catatan alasan. |
| **Jaminan Kualitas Kode** | Perubahan dilindungi oleh automated tests dan seeded fault test. | 0 automated tests di repository awal. | **Risiko Regresi**: Tidak ada jaring pengaman otomatis untuk verifikasi kualitas rilis. |

---

## 6. Risiko Keamanan, Privasi, Reliabilitas, dan Integritas Evaluasi AI

1. **Risiko Integritas Produk & Pengalaman Kandidat (High)**:
   Kombinasi antara link undangan yang mengarah ke port salah (GAP-01) dan penanganan error yang memicu status "Complete" (GAP-02) menciptakan skenario fatal: recruiter mengira kandidat mangkir, sementara kandidat mengira wawancara mereka telah selesai dievaluasi.
2. **Risiko Kepatuhan Regulasi (UU PDP No. 27/2022) (High)**:
   Data suara dan evaluasi kemampuan kerja kandidat adalah data pribadi spesifik. Kegagalan menyediakan mekanisme persetujuan yang sah dapat menghadapkan platform pada sanksi administratif dan hukum.
3. **Risiko Keamanan Multi-Tenant (Medium-High)**:
   Celah IDOR pada export portofolio memungkinkan kebocoran laporan kandidat ke organisasi lain yang memiliki akses asesor.
4. **Risiko Integritas Evaluasi AI (Medium)**:
   Override assessor tanpa justifikasi tertulis memungkinkan intervensi subjektif tanpa jejak audit, merusak tujuan awal platform sebagai alat penilai kompetensi objektif berbasis rubrik L1–L5.

---

## 7. Area yang Belum Dapat Diverifikasi Sepenuhnya

1. **Live Gemini Audio Latency & Reconnect under Network Jitter**:
   Pengujian sesi audio penuh dengan Gemini Live API membutuhkan `GEMINI_API_KEY` produksi yang valid serta mikrofon fisik aktif. Saat ini menggunakan dummy key lokal, sehingga perilaku reconnect WebSocket audio pada kondisi jaringan nyata baru dapat diverifikasi melalui unit/request mocking.
2. **Sidekiq Retries Exhausted Behavior pada Kegagalan Eksternal LLM**:
   Perilaku kegagalan berulang model Gemini (kuota habis / timeout 3x) pada `PortfolioGeneratorWorker` telah diverifikasi secara kode, namun belum diuji di bawah beban konkurensi tinggi.

---

## 8. Prioritas Perbaikan dan Rekomendasi Vertical Slice

Berdasarkan dampak bisnis, tingkat keparahan, dan ketercakupan backend-frontend, masalah dengan prioritas tertinggi untuk diselesaikan sebagai **Vertical Slice Utama** adalah:

### **Pilihan Vertical Slice: Candidate Onboarding Resilience & Honest Failure Handling (GAP-01 + GAP-02 + GAP-03)**

#### Mengapa Slice Ini Dipilih?
1. **Dampak Nyata Tertinggi (P0)**: Menyentuh pintu gerbang utama platform. Jika kandidat tidak dapat bergabung atau disesatkan oleh status sukses palsu, seluruh workflow downstream (transkripsi, analisis coverage, portofolio, dan fit/gap) tidak akan pernah terjadi.
2. **Ketercakupan Fullstack Sejati**:
   - **Backend**: Memperbaiki resolusi `invite_url` di model `Session`, menambahkan konfigurasi `FRONTEND_URL`, menyediakan validasi token status (`active`, `expired`, `invalid`), serta menambahkan pencatatan persetujuan (*consent*).
   - **Frontend**: Merombak total state machine pada `InterviewPage.tsx`, menyediakan state `loading`, `error` (dengan kode spesifik: *Invalid Link*, *Session Expired*, *Network Error*), mekanisme *retry*, serta menambahkan **Consent & Privacy Notice Banner** yang mematuhi prinsip UU PDP sebelum hardware check dijalankan.
3. **Bisa Dilindungi dengan Automated Tests**: Dapat diuji secara deterministik dengan RSpec (backend request/model spec) dan pengujian otomatis frontend, serta ideal untuk *seeded fault testing*.

---

## 9. Usulan Acceptance Criteria Awal (Untuk Fase 3)

### Kriteria 1: Resolusi URL Undangan Kandidat
- [ ] Model `Session#invite_url` menghasilkan URL yang mengarah ke host dan port frontend web (berdasarkan `FRONTEND_URL` / `APP_BASE_URL` yang tepat).
- [ ] Link undangan yang disalin dari halaman `AssessmentInvitePage` langsung membuka halaman wawancara kandidat di frontend port 5173 tanpa error 404.

### Kriteria 2: Penanganan Error & Kejujuran Status Sesi Kandidat
- [ ] Jika token undangan tidak ditemukan (404), frontend menampilkan halaman error: *"Undangan Tidak Valid — Link wawancara tidak ditemukan atau telah kedaluwarsa"* (bukan layar *Interview Complete*).
- [ ] Jika server API offline atau request mengalami timeout, frontend menampilkan status error koneksi: *"Koneksi Terputus — Gagal menghubungkan ke server"* dengan tombol *"Coba Lagi"*.
- [ ] Layar *Interview Complete* HANYA ditampilkan jika sesi memang benar-benar berstatus `ended` dari database setelah wawancara berlangsung.

### Kriteria 3: Consent & Privacy Notice (UU PDP)
- [ ] Sebelum hardware check / mikrofon aktif, kandidat disajikan ringkasan transparan mengenai: pengumpulan rekaman suara, analisis AI, dan tujuan seleksi.
- [ ] Kandidat harus mencentang persetujuan pemrosesan data pribadi sebelum tombol mulai wawancara dapat diklik.
- [ ] Status persetujuan dikirim dan dicatat secara aman di backend.

### Kriteria 4: Pengujian Otomatis & Seeded Fault Test
- [ ] Tersedia request spec backend yang memverifikasi rute kandidat, validasi token, dan invite URL.
- [ ] Tersedia pengujian frontend untuk validasi state loading, error, retry, dan consent.
- [ ] Satu seeded fault test membuktikan bahwa tes mendeteksi regresi jika error handling sengaja dirusak kembali ke `.catch(() => setInterviewState("complete"))`.
