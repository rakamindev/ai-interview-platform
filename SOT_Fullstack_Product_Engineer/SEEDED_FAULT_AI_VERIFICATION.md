# Fase 5: Seeded Fault Test & AI Verification Report
## Case Study: AI Interview Platform (`ai-interview-platform`)

Dokumen ini merupakan artefak resmi **Fase 5** yang mencatat pelaksanaan pengujian regresi dengan metode injeksi kesalahan terkontrol (*seeded fault testing*) pada backend dan frontend, serta dokumentasi kasus nyata verifikasi saran kecerdasan buatan (*AI verification moments*) selama pengerjaan implementasi.

---

## 1. Tujuan & Metodologi Fase 5

Sesuai dengan pedoman [IMPLEMENTATION_PLAN.md](file:///a:/ai-interview-platform/SOT_Fullstack_Product_Engineer/IMPLEMENTATION_PLAN.md) dan [AGENTS.md](file:///a:/ai-interview-platform/SOT_Fullstack_Product_Engineer/AGENTS.md):
1. **Seeded Fault Test**: Membuktikan secara objektif dan deterministik bahwa *test suite* yang dibuat benar-benar mampu mendeteksi kerusakan fungsi/regresi, dan bukan sekadar tes formalitas (*tautological tests*). Pengujian dilakukan baik pada ranah Frontend (React) maupun Backend (Rails).
2. **AI Verification Moment**: Mendokumentasikan secara faktual saran atau kode AI yang tidak tepat atau berisiko, risiko yang ditimbulkan, metode verifikasi teknis yang digunakan, koreksi arsitektural yang diambil, serta bukti hasil verifikasi.
3. **Pembersihan Working Tree (Gate 5)**: Memastikan seluruh kode eksperimen dibatalkan (*reverted*) dan working tree dalam status bersih sebelum rilis ke Fase 6.

---

## 2. Seeded Fault Test #1 — Frontend: Deteksi False Success State (GAP-02)

### A. Skenario & Injeksi Kesalahan
Pada `web/src/pages/interview/InterviewPage.tsx`, logika penanganan error jaringan/token tidak valid yang telah diperbaiki dengan Finite State Machine (FSM) sengaja disuntikkan kembali dengan bug lama:
```typescript
} catch (err: any) {
  // SEEDED FAULT: Mengembalikan bug lama yang memicu false success
  setPageStatus("complete");
}
```

### B. Hasil Eksekusi Test Runner (`npm.cmd test`)
Test runner Vitest segera **GAGAL (RED)** dan menangkap regresi tersebut dengan pesan kegagalan eksplisit:
```text
FAIL  src/__tests__/InterviewPage.test.tsx > InterviewPage Candidate Onboarding Resilience & Error Handling > does NOT show 'Interview Complete' when candidate fetch fails with 404 (GAP-02)
Error: expect(element).not.toBeInTheDocument()

expected document not to contain element, found <h2 class="text-xl font-semibold">Interview Complete</h2> instead
  ❯ src/__tests__/InterviewPage.test.tsx:70:48
```

### C. Pemulihan & Verifikasi Ulang
Kode eksperimen dikembalikan ke penanganan FSM yang benar:
```typescript
} catch (err: any) {
  if (err.response?.status === 404) {
    setPageStatus("invalid_token");
  } else {
    setPageStatus("network_error");
  }
}
```
Hasil verifikasi ulang (`npm.cmd test`):
```text
Test Files  1 passed (1)
     Tests  4 passed (4)
  Duration  480ms (100% PASS - GREEN)
```

---

## 3. Seeded Fault Test #2 — Backend: Deteksi Cross-Tenant IDOR (GAP-04)

### A. Skenario & Injeksi Kesalahan
Pada `api/app/controllers/api/v1/portfolios_controller.rb`, relational scoping multi-tenant pada method `set_portfolio` sengaja dilemahkan kembali ke implementasi lama yang rentan IDOR:
```ruby
def set_portfolio
  if @session
    @portfolio = @session.portfolio
  else
    # SEEDED FAULT: Menghapus filter tenant_id (GAP-04 regression test)
    @portfolio = Portfolio.find(params[:id])
  end
rescue ActiveRecord::RecordNotFound
  json_error("Portfolio not found", :not_found)
end
```

### B. Hasil Eksekusi Test Runner (`bundle exec rspec spec/requests/api/v1/portfolios_tenant_spec.rb`)
RSpec segera **GAGAL (RED)** karena request dari Assessor Organisasi Alpha untuk mengekspor portofolio milik Organisasi Beta yang seharusnya menghasilkan `404 Not Found` justru meloloskan data dengan status `200 OK`:
```text
Randomized with seed 50185
.F

Failures:

  1) Portfolio Tenant Isolation (IDOR Protection) Cross-Tenant Access Restrictions denies Org Alpha assessor from exporting Org Beta portfolio (returns 404)
     Failure/Error: expect(response).to have_http_status(:not_found)
       expected the response to have a not_found status code (404) but it was 200
     # ./spec/requests/api/v1/portfolios_tenant_spec.rb:81:in `block (3 levels) in <top (required)>'

Finished in 11.59 seconds (files took 1 minute 12.33 seconds to load)
2 examples, 1 failure
```

### C. Pemulihan & Verifikasi Ulang
Kode dikembalikan ke implementasi relasional tenant yang aman:
```ruby
def set_portfolio
  if @session
    @portfolio = @session.portfolio
  else
    @portfolio = Portfolio.joins(:session)
                          .where(sessions: { tenant_id: current_tenant_id })
                          .find(params[:id])
  end
rescue ActiveRecord::RecordNotFound
  json_error("Portfolio not found", :not_found)
end
```
Hasil verifikasi ulang (`bundle exec rspec spec/requests/api/v1/portfolios_tenant_spec.rb`):
```text
Randomized with seed 63133
..

Finished in 0.30788 seconds
2 examples, 0 failures (100% PASS - GREEN)
```

---

## 4. AI Verification Moments (Dokumentasi Kasus Nyata)

Sesuai panduan etika rekayasa dan seleksi teknis, berikut adalah 2 contoh nyata saran / kode AI yang salah atau berisiko, serta bagaimana tim merekayasa verifikasi dan perbaikannya:

### Kasus 1: Scoping Multi-Tenant pada Endpoint Publik Kandidat (GAP-03 & Onboarding)
- **Saran Awal AI**:
  Ketika mengimplementasikan endpoint publik `GET /api/v1/sessions/:token/candidate` dan `POST /api/v1/sessions/:token/consent`, AI menyarankan pencarian record sesi menggunakan helper ActiveRecord standar:
  ```ruby
  session = Session.find_by(invite_token: params[:token])
  ```
- **Mengapa Berisiko**:
  Aplikasi ini menggunakan paradigma multi-tenancy di mana seluruh query default pada model `Session` di-*scope* ke `current_tenant_id` (via `Current.tenant_id`). Kandidat mengakses tautan undangan melalui browser tanpa login JWT asesor (`current_tenant_id` bernilai `nil`). Akibatnya, query yang disarankan AI otomatis menghasilkan klausul SQL `WHERE sessions.tenant_id IS NULL`, sehingga sesi kandidat **tidak akan pernah ditemukan (selalu 404)** meskipun `invite_token` valid dan ada di database.
- **Cara Memverifikasi**:
  Pengujian integrasi otomatis RSpec pada `spec/requests/api/v1/sessions_candidate_spec.rb`. Ketika spec dijalankan, endpoint mengembalikan 404 Not Found untuk token yang valid.
- **Koreksi yang Dibuat**:
  Menggunakan `Session.unscoped.find_by(invite_token: params[:token])` pada controller publik kandidat. Karena `invite_token` dijamin unik di seluruh tabel (string heksadesimal 64 karakter), pencarian `unscoped` aman dari tabrakan dan tetap menjaga kandidat dapat mengakses sesinya tanpa harus memiliki kredensial login asesor.
- **Bukti Hasil Verifikasi**:
  RSpec spec `spec/requests/api/v1/sessions_candidate_spec.rb` lulus 100% (5/5 examples passing).

---

### Kasus 2: Puma Worker Concurrency Forking di Lingkungan Host Windows (Fase 0/4)
- **Saran Awal AI**:
  AI merekomendasikan menjalankan Puma API server menggunakan konfigurasi default kluster produksi:
  ```ruby
  workers ENV.fetch('WEB_CONCURRENCY', 2)
  preload_app!
  ```
- **Mengapa Berisiko**:
  Sistem operasi Windows tidak mendukung sistem panggilan POSIX `fork()`. Ketika Puma mencoba menginisialisasi mode kluster dengan `workers > 0` di Windows, Ruby melempar `NotImplementedError` atau mengalami crash instan pada proses boot, sehingga Rails API server gagal berjalan total.
- **Cara Memverifikasi**:
  Menjalankan perintah `bundle exec puma -C config/puma.rb` di terminal PowerShell. Server langsung mati saat inisialisasi child worker.
- **Koreksi yang Dibuat**:
  Memperbarui `api/config/puma.rb` dengan deteksi platform otomatis:
  ```ruby
  worker_count = ENV.fetch('WEB_CONCURRENCY', Gem.win_platform? ? 0 : 2).to_i
  workers worker_count

  if worker_count > 0
    preload_app!
    on_worker_boot do
      # EventMachine reactor initialization for child processes
    end
  end
  ```
  Di Windows, Puma otomatis beroperasi dalam mode *single-process multi-threaded* (`workers = 0`), sementara di lingkungan produksi Linux/Docker tetap dapat memanfaatkan *multi-worker cluster*.
- **Bukti Hasil Verifikasi**:
  Server Puma berhasil berjalan stabil di port 3001, melayani request HTTP dan WebSocket audio relay secara bersamaan tanpa crash.

---

## 5. Ringkasan Kepatuhan Gate 5

| Item Kepatuhan | Standar Evaluasi | Status | Bukti Verifikasi |
|---|---|---|---|
| **Frontend Seeded Fault** | Tes gagal saat bug diinjeksi, lulus saat dipulihkan | **TERPENUHI (PASS)** | Vitest menangkap false success bug (RED), pulih 4/4 PASS. |
| **Backend Seeded Fault** | Tes gagal saat filter IDOR dihilangkan, lulus saat dipulihkan | **TERPENUHI (PASS)** | RSpec menangkap status 200 alih-alih 404 (RED), pulih 2/2 PASS. |
| **AI Verification Moment** | Fakta nyata, risiko jelas, koreksi teruji | **TERPENUHI (PASS)** | Dokumentasi kasus `Session.unscoped` & Puma Windows concurrency. |
| **Working Tree Cleanliness** | Tidak ada kode fault yang tertinggal | **TERPENUHI (PASS)** | `git diff` membuktikan working tree bersih dari kode eksperimen. |

**Kesimpulan Gate 5: LULUS (PASS)** — Siap untuk melanjutkan ke **Fase 6: PR dan Submission Package**.
