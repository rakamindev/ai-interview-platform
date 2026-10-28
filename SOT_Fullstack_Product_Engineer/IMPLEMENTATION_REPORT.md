# Implementation & Submission Report: Vertical Slice Onboarding Resilience & Honest Failure Handling
## Case Study: AI Interview Platform (`ai-interview-platform`)

Dokumen ini merupakan laporan resmi **Fase 4, 5, dan Submission Package Fase 6** yang mencatat seluruh perubahan kode (backend dan frontend), eksekusi migrasi database, implementasi test suites, hasil verifikasi pengujian otomatis aktual, bukti *seeded fault test*, keputusan desain, kepatuhan UU PDP, risiko tersisa, serta panduan operasional pada branch `feat/fullstack-product-case-study`.

---

## 1. Ringkasan Eksekutif Implementasi

Vertical slice **"Candidate Onboarding Resilience & Honest Failure Handling"** telah selesai diimplementasikan secara penuh mencakup backend Rails 7, frontend React 18, PostgreSQL 18.6, dan test harness (RSpec 6 & Vitest 5):

- **GAP-01 (Invite URL Port Mismatch — P0)**: `Session#invite_url` kini memprioritaskan konfigurasi `FRONTEND_URL` (fallback ke `http://localhost:5173` di development) alih-alih port backend Rails (3001), memulihkan akses 100% kandidat ke antarmuka wawancara.
- **GAP-02 (Deceptive False Success State — P0)**: Menghapus total baris `.catch(() => setInterviewState("complete"))` pada `InterviewPage.tsx`. Menggantinya dengan Finite State Machine (FSM) yang membedakan secara jujur antara `invalid_token` (404), `network_error` (disertai tombol retry aman), `session_expired`, `consent_pending`, `hardware_check`, dan `complete` (hanya jika terkonfirmasi `ended` secara sah dari database).
- **GAP-03 (Privacy Notice & Consent Tracking UU PDP No. 27/2022 — P1)**: Menambahkan skema migrasi `consented_at` dan `consent_version` pada tabel `sessions`, endpoint `POST /api/v1/sessions/:token/consent`, komponen antarmuka *Persetujuan Pemrosesan Data Pribadi*, serta gatekeeper sisi server pada `AudioWebSocketMiddleware` untuk menolak koneksi audio jika persetujuan belum tercatat.
- **GAP-04 (Cross-Tenant IDOR Protection — P1)**: Menutup celah otorisasi pada seluruh aksi `PortfoliosController` (`show`, `export`, `regenerate_fitgap`, `fitgap`, `show_fitgap`) dan `PortfolioSkillsController` (`override`) dengan membatasi query melalui relasi tenant `joins(:session).where(sessions: { tenant_id: current_tenant_id })`. Akses lintas tenant ditolak dengan HTTP 404.
- **GAP-07 (Automated Regression Testing & Tooling — P1)**: Menginisialisasi RSpec 6 di backend (18/18 specs PASS mencakup model, candidate onboarding, consent rejection on ended sessions, dan comprehensive cross-tenant IDOR) dan Vitest di frontend (4/4 tests PASS). Menjalankan Seeded Fault Test yang membuktikan tes gagal menangkap regresi secara deterministik.
- **GAP-08 (Documentation Port Fix — P3)**: Memperbarui `web/.env.example` agar merujuk ke port default Rails 3001.

---

## 2. Daftar File yang Berubah dan Alasan Perubahan

### A. Backend (Ruby on Rails 7)
1. **`api/db/migrate/20261025000001_add_consent_tracking_to_sessions.rb`** (Baru):
   Menambahkan kolom `consented_at: datetime` dan `consent_version: string(20)` pada tabel `sessions` untuk kebutuhan audit trail kepatuhan UU PDP No. 27/2022.
2. **`api/app/models/session.rb`**:
   - Memperbarui method `invite_url` agar membaca `ENV['FRONTEND_URL']` dan menghapus trailing slash secara bersih (`chomp('/')`).
   - Menambahkan helper method `consented? = consented_at.present?`.
3. **`api/app/controllers/api/v1/sessions_controller.rb`**:
   - Memperbarui `candidate_info` agar menyertakan status `has_consented`, `consented_at`, dan `candidate_name`.
   - Menambahkan action `consent` (`POST /sessions/:token/consent`) menggunakan `Session.unscoped.find_by` untuk mencatat waktu persetujuan kandidat tanpa hambatan multi-tenant filter.
   - Menambahkan validasi penolakan consent pada sesi yang telah berakhir (`return json_error("Session has already ended", :unprocessable_entity) if session.ended?`).
   - Menambahkan `:consent` ke daftar pengecualian autentikasi token JWT assessor (`except: %i[candidate_info audio_complete consent]`).
4. **`api/config/routes.rb`**:
   Mendaftarkan rute `post 'sessions/:token/consent', to: 'sessions#consent'`.
5. **`api/app/controllers/concerns/response.rb`**:
   Memperbarui helper `json_error` agar menyertakan kunci `error: message` bersamaan dengan array `errors:` untuk kompatibilitas multi-klien frontend.
6. **`api/app/controllers/api/v1/portfolios_controller.rb`**:
   Menerapkan relational scoping pada `set_portfolio` melalui `Portfolio.joins(:session).where(sessions: { tenant_id: current_tenant_id })` dan menerapkannya pada seluruh aksi: `show`, `export`, `regenerate_fitgap`, `fitgap`, dan `show_fitgap` untuk mencegah eksfiltrasi portofolio antar-organisasi (GAP-04).
7. **`api/app/controllers/api/v1/portfolio_skills_controller.rb`**:
   Menerapkan relational scoping pada `set_portfolio_skill` melalui `PortfolioSkill.joins(portfolio: :session).where(sessions: { tenant_id: current_tenant_id })` untuk mencegah override skill antar-organisasi (GAP-04).
8. **`api/app/channels/audio_websocket_middleware.rb`**:
   Menambahkan validasi sisi server `return [nil, 'Candidate consent required'] unless session.consented_at.present?` pada `authenticate_and_load`.
9. **`api/config/puma.rb`**:
   Menyesuaikan worker concurrency dengan deteksi platform `Gem.win_platform? ? 0 : 2` dan membungkus `preload_app!` agar Puma berjalan mulus di Windows tanpa merusak mode kluster produksi di Linux.

### B. Frontend (React 18 + Vite)
1. **`web/src/pages/interview/InterviewPage.tsx`**:
   - Merombak arsitektur halaman menjadi Finite State Machine (FSM): `loading`, `invalid_token`, `network_error`, `session_expired`, `consent_pending`, `hardware_check`, `ready`, `in_interview`, `complete`.
   - Menghapus blok catch palsu `.catch(() => setInterviewState("complete"))`.
   - Menyediakan UI kartu error informatif untuk token tidak valid (404).
   - Menyediakan UI kartu koneksi terputus dengan tombol **"Coba Lagi" (Retry)** idempoten.
   - Menyediakan kartu **Persetujuan Pemrosesan Data Pribadi (UU PDP No. 27/2022)** dengan checkbox eksplisit sebelum hardware check.
   - Memastikan layar `complete` hanya ditampilkan jika sesi berstatus `ended` secara sah dari database.
2. **`web/src/types/index.ts`**:
   Memperbarui interface `CandidateInfo` dengan `has_consented?: boolean; consented_at?: string; candidate_name?: string;`.
3. **`web/src/services/sessions.ts`**:
   Menambahkan fungsi `recordConsent: (token, version) => api.post(...)`.
4. **`web/.env.example`**:
   Mengoreksi `VITE_API_BASE_URL` dan `VITE_WS_BASE_URL` dari port 3000 ke port 3001.

### C. Automated Test Suites & Tooling
1. **`api/spec/spec_helper.rb` & `api/spec/rails_helper.rb`** (Baru):
   Konfigurasi test runner RSpec 6 dengan isolasi transaksi database.
2. **`api/spec/models/session_spec.rb`** (Baru):
   Model spec untuk resolusi `Session#invite_url` dan keunikan token 64 karakter.
3. **`api/spec/requests/api/v1/sessions_candidate_spec.rb`** (Baru):
   Request spec untuk endpoint kandidat, penolakan 404, dan pencatatan consent.
4. **`api/spec/requests/api/v1/portfolios_tenant_spec.rb`** (Baru):
   Request spec pengujian keamanan multi-tenant IDOR (Org Alpha vs Org Beta sintetis).
5. **`web/src/__tests__/InterviewPage.test.tsx`** (Baru):
   Component test Vitest untuk memverifikasi penghapusan false success state, penanganan error jaringan, dan keharusan consent.
6. **`web/src/test/setup.ts` & `web/vite.config.ts`**:
   Setup Vitest + `@testing-library/jest-dom` + jsdom.

---

## 3. Ringkasan Migrasi Database

- **File Migrasi**: `api/db/migrate/20261025000001_add_consent_tracking_to_sessions.rb`
- **Operasi**:
  ```ruby
  add_column :sessions, :consented_at, :datetime
  add_column :sessions, :consent_version, :string, limit: 20
  ```
- **Verifikasi Status Migrasi (`rails db:migrate:status`)**:
  ```text
   Status   Migration ID    Migration Name
  --------------------------------------------------
     up     20231201000000  Create organizations
     up     20240101000000  Create ai interview schema
     up     20260320000000  Create skill taxonomies
     up     20260320000001  Create ai interview users
     up     20260323032702  Add language to assessments
     up     20260411000000  Add 10 min to time limit options
     up     20260505000000  Add indexes to organizations
     up     20260505000001  Add candidate id indexes
     up     20260505000002  Add candidate name to sessions
     up     20261025000001  Add consent tracking to sessions
  ```
- **Sifat Migrasi**: Kolom bersifat `nullable`, sehingga aman terhadap data sesi lama (*backwards compatible* dan *reversible*).

---

## 4. Hasil Pengujian Otomatis (Eksekusi Aktual)

### A. Backend Test Suite (RSpec 6)
- **Perintah**: `bundle exec rspec`
- **Hasil Eksekusi**:
  ```text
  Randomized with seed 45215
  ..................

  Finished in 4 minutes 8.7 seconds (files took 10.2 seconds to load)
  18 examples, 0 failures
  ```
- **Rincian Suite**:
  - `spec/models/session_spec.rb`: 5 examples (resolusi `invite_url` port 5173, trailing slash, token uniqueness).
  - `spec/requests/api/v1/sessions_candidate_spec.rb`: 7 examples (candidate info, 404 on invalid token, 200 on ended session status, consent recording, 404 on invalid consent token, 422 rejection on ended session, idempotent repeat consent).
  - `spec/requests/api/v1/portfolios_tenant_spec.rb`: 6 examples (404 rejection on show, export, fitgap, regenerate_fitgap, show_fitgap, and skill override across tenants).
- **Status: 18/18 Specs Lulus (100% PASS)**

### B. Frontend Test Suite (Vitest 5)
- **Perintah**: `npm.cmd test`
- **Hasil Eksekusi**:
  ```text
   RUN  v5.0.5 A:/ai-interview-platform/web

   ✓ src/__tests__/InterviewPage.test.tsx (4 tests) 312ms

   Test Files  1 passed (1)
        Tests  4 passed (4)
     Duration  40.85s
  ```
- **Status: 4/4 Tests Lulus (100% PASS)**

### C. Frontend Type-Check & Production Build
- **Perintah**: `npm.cmd run build` (`tsc && vite build`)
- **Hasil Eksekusi**:
  ```text
  vite v6.4.5 building for production...
  ✓ 1841 modules transformed.
  rendering chunks...
  dist/index.html                         0.64 kB │ gzip:  0.33 kB
  dist/assets/index-CrHGerQ0.css         30.84 kB │ gzip:  6.40 kB
  dist/assets/vendor-ui-DYhNZzle.js     104.61 kB │ gzip: 35.42 kB
  dist/assets/vendor-misc-BDVdIyKs.js   117.72 kB │ gzip: 41.55 kB
  dist/assets/vendor-react-D3w9ihCe.js  181.45 kB │ gzip: 59.79 kB
  dist/assets/index-BftiBYE2.js         188.88 kB │ gzip: 53.91 kB
  ✓ built in 15.88s
  ```
- **Status: 0 Type Errors, 0 Build Errors**

---

## 5. Bukti Seeded Fault Test Fase 5

Pengujian regresi terkontrol dieksekusi pada backend dan frontend untuk membuktikan bahwa *test suite* mendeteksi bug secara deterministik:

### A. Frontend Seeded Fault (GAP-02)
- **Injeksi Kesalahan**: Mengembalikan catch block di `InterviewPage.tsx` ke bug lama `setPageStatus("complete")`.
- **Hasil Test Runner (`npm.cmd test`)**: Gagal (**RED**) dengan pesan `expected document not to contain element, found <h2>Interview Complete</h2> instead`.
- **Pemulihan**: Kode dikembalikan ke FSM $\rightarrow$ Lulus (**GREEN**, 4/4 pass).

### B. Backend Seeded Fault (GAP-04)
- **Injeksi Kesalahan**: Melepaskan tenant filter di `set_portfolio` menjadi `@portfolio = Portfolio.find(params[:id])`.
- **Hasil Test Runner (`bundle exec rspec spec/requests/api/v1/portfolios_tenant_spec.rb`)**: Gagal (**RED**) dengan pesan `expected the response to have a not_found status code (404) but it was 200`.
- **Pemulihan**: Kode dikembalikan ke scoping relasional $\rightarrow$ Lulus (**GREEN**, 6/6 pass).

---

## 6. Status Acceptance Criteria (PRD & Case Study)

| Kriteria | Deskripsi Kebutuhan | Status | Bukti Verifikasi |
|---|---|---|---|
| **AC-01** | **Resolusi & Validasi URL Undangan** | **TERPENUHI (PASS)** | RSpec `session_spec.rb` memverifikasi `invite_url` menggunakan `FRONTEND_URL` port 5173. Browser membuka link tanpa 404 Rails. |
| **AC-02** | **Kejujuran Penanganan Error & FSM** | **TERPENUHI (PASS)** | Vitest `InterviewPage.test.tsx` memverifikasi 404 menampilkan "Link Tidak Ditemukan", error jaringan menyediakan "Coba Lagi", dan status complete dibatasi hanya untuk sesi `ended`. |
| **AC-03** | **Kepatuhan Privasi Data & Gating Audio** | **TERPENUHI (PASS)** | Migrasi database mencatat `consented_at`. Endpoint menolak consent jika sesi sudah ended. `AudioWebSocketMiddleware` menolak audio jika belum consent. |
| **AC-04** | **Isolasi Keamanan Multi-Tenant (IDOR)** | **TERPENUHI (PASS)** | RSpec `portfolios_tenant_spec.rb` membuktikan Assessor Org Alpha ditolak (HTTP 404) saat mencoba show, export, fitgap, regenerate_fitgap, show_fitgap, maupun override skill Org Beta. |
| **AC-05** | **Jaminan Mutu Pengujian & Seeded Fault** | **TERPENUHI (PASS)** | 18/18 RSpec specs lulus, 4/4 Vitest tests lulus, frontend build 0 error, dan seeded fault test membuktikan deteksi kegagalan regresi secara deterministik. |

---

## 7. Keputusan Desain & AI Verification Moments

### A. Keputusan Arsitektur Kunci
1. **Finite State Machine (FSM) Terbuka vs Boolean Flags**:
   Menghindari kekacauan *conditional rendering* dengan membagi alur onboarding menjadi **9 state eksplisit**: `loading`, `invalid_token`, `network_error`, `session_expired`, `consent_pending`, `hardware_check`, `ready`, `in_interview`, `complete`.
2. **Pertahanan Berlapis (*Defense-in-Depth*) untuk UU PDP**:
   Persetujuan data biometrik suara tidak hanya dicek di frontend (checkbox & disabled button), tetapi dijamin oleh backend melalui penolakan transmisi audio pada level Rack WebSocket middleware jika `consented_at` kosong, serta penolakan consent baru jika status sesi telah berakhir.
3. **Relational Tenant Scoping vs Column Checking**:
   Tabel `portfolios` tidak memiliki kolom `tenant_id` langsung. Alih-alih menambahkan redundansi kolom, isolasi tenant ditegakkan secara aman melalui relasi `Portfolio.joins(:session).where(sessions: { tenant_id: current_tenant_id })` yang kini mengamankan seluruh aksi portofolio dan Fit/Gap.

### B. AI Verification Moments (Dokumentasi Kasus Nyata)
1. **Kasus Multi-Tenant Scoping pada Endpoint Publik Kandidat**:
   - *Saran AI*: Menggunakan `Session.find_by(invite_token: params[:token])`.
   - *Risiko*: Menambahkan klausul default `WHERE sessions.tenant_id IS NULL` karena kandidat belum login asesor, menyebabkan token yang sah selalu menghasilkan HTTP 404.
   - *Verifikasi & Koreksi*: Dideteksi melalui request spec RSpec; dikoreksi menggunakan `Session.unscoped.find_by(invite_token: ...)` karena keunikan token heksadesimal 64 karakter telah menjamin keamanan lookup tanpa login asesor.
2. **Kasus Worker Forking di Host Windows OS**:
   - *Saran AI*: Mengaktifkan `workers ENV.fetch('WEB_CONCURRENCY', 2)` dengan `preload_app!`.
   - *Risiko*: Windows tidak memiliki fungsi POSIX `fork()`, memicu crash instan `NotImplementedError` pada Puma saat booting.
   - *Verifikasi & Koreksi*: Diverifikasi saat booting server di PowerShell; dikoreksi dengan deteksi otomatis `Gem.win_platform? ? 0 : 2`.

---

## 8. Risiko Tersisa & Pekerjaan yang Ditunda (Deferred Scope)

1. **GAP-05 (Assessor Notes Opsional pada Override — P2)**:
   Saat ini asesor dapat melakukan override skor tanpa mengisi catatan alasan. *Mitigasi mendatang*: Menambahkan validasi keberadaan teks minimal 20 karakter pada kolom catatan asesor di `AssessorOverride`.
2. **GAP-06 (Asesmen Tanpa Skill Diizinkan — P2)**:
   Saat ini form pembuatan asesmen dapat disimpan tanpa memilih minimal satu skill. *Mitigasi mendatang*: Menambahkan validasi `validates :skills, presence: true, length: { minimum: 1 }` pada model `Assessment`.
3. **Pencabutan Persetujuan Data (*Consent Revocation*)**:
   Implementasi saat ini mencatat pemberian izin (*opt-in*). Hak penarikan kembali persetujuan (*opt-out*) sesuai UU PDP Pasal 40 belum memiliki antarmuka mandiri bagi kandidat dan ditangani melalui kanal manual HR.
4. **Grace Period Koneksi WebSocket Audio Eksternal**:
   Durasi `BROWSER_GRACE_PERIOD` 120 detik diterapkan pada `AudioWebSocketMiddleware` untuk menjaga sesi AI Gemini tetap aktif saat kandidat me-refresh browser atau mengalami *network hiccup* singkat, sebelum sesi diakhiri secara anggun (*graceful shutdown*).
5. **Cakupan Pengujian Keamanan Aplikasi Menyeluruh**:
   Pengujian IDOR yang dilakukan berfokus penuh pada vertical slice portofolio, sesi, dan Fit/Gap yang diaudit. Rute warisan lainnya di luar scope ini tidak diklaim bebas celah tanpa pengujian penetrasi menyeluruh di masa mendatang.

---

## 9. Panduan Setup, Konfigurasi & Menjalankan Aplikasi

### Kebutuhan Lingkungan (Prerequisites)
- **OS**: Windows x64 / Linux / macOS
- **Ruby**: 3.3.2 (disertai DevKit di Windows)
- **Node.js**: v18+ (terverifikasi di v24.14.1)
- **PostgreSQL**: v14+ (terverifikasi di v18.6)
- **Redis**: v6+ (terverifikasi di v8.10.2)

### Konfigurasi Environment Variables
1. **Backend (`api/.env`)**:
   ```env
   PORT=3001
   FRONTEND_URL=http://localhost:5173
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rakamin_development
   REDIS_URL=redis://localhost:6379/0
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
2. **Frontend (`web/.env`)**:
   ```env
   VITE_API_BASE_URL=http://localhost:3001/api/v1
   VITE_WS_BASE_URL=ws://localhost:3001
   ```

### Langkah Menjalankan Aplikasi
1. **Migrasi Database**:
   ```powershell
   cd api
   bundle install
   bundle exec rails db:migrate
   bundle exec rails db:seed
   ```
2. **Menjalankan API Server**:
   ```powershell
   bundle exec rails server -p 3001
   ```
3. **Menjalankan Frontend Web**:
   ```powershell
   cd ../web
   npm install
   npm run dev
   ```
4. **Menjalankan Pengujian Otomatis**:
   - Backend: `cd api; bundle exec rspec`
   - Frontend: `cd web; npm test`

---

## 10. Ringkasan Perubahan Git & Rekomendasi Commit

Branch aktif: `feat/fullstack-product-case-study`

Rekomendasi commit terstruktur (6 atomik commit):
1. `test(backend): setup RSpec 6 and add regression specs for session, candidate info, and tenant IDOR`
2. `test(frontend): setup Vitest and add component tests for interview error handling and consent`
3. `feat(api): resolve frontend invite url and add privacy consent tracking with audio gate`
4. `sec(api): enforce relational tenant scoping on portfolios and portfolio skills controllers`
5. `feat(web): implement robust candidate onboarding state machine with honest errors and consent banner`
6. `docs: add comprehensive SOT documents (Phase 0 - 5 reports and submission package)`
