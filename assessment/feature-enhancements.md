# Dokumentasi Fitur & Pengembangan Baru (Feature Enhancements & UI Revamp)

Dokumentasi ini merangkum serangkaian fitur baru, perbaikan alur pengguna (UX), serta pembaruan arsitektur antarmuka yang dikembangkan untuk melengkapi sistem **Rakamin AI Interview Platform**.

---

## 📑 Daftar Isi
1. [Menu Baru: Global Candidates Pool & Monitoring (`/candidates`)](#1-menu-baru-global-candidates-pool--monitoring-candidates)
2. [Fitur Quick Invite & Test Candidate Modal](#2-fitur-quick-invite--test-candidate-modal)
3. [Searchable Assessment Selector](#3-searchable-assessment-selector)
4. [Smart History Back Navigation (`navigate(-1)`)](#4-smart-history-back-navigation-navigate-1)
5. [Modernisasi UI Portfolio, Transkrip & Direct File Download](#5-modernisasi-ui-portfolio-transkrip--direct-file-download)
6. [Sistem Paginasi Reusable (`PaginationControl`)](#6-sistem-paginasi-reusable-paginationcontrol)
7. [Integrasi Brand Identity Resmi Rakamin](#7-integrasi-brand-identity-resmi-rakamin)

---

## 1. Menu Baru: Global Candidates Pool & Monitoring (`/candidates`)

### 🔍 Latar Belakang & Pain Point
Sebelumnya, sistem hanya memiliki navigasi `Assessments` dan `Vacancies`. Jika HR/Assessor mengelola banyak lowongan aktif (misal: *Frontend*, *Backend*, *UI/UX*, *QA*, *PM*), HR mengalami kesulitan:
- **Harus Buka-Tutup Manual**: Harus masuk ke dalam detail tiap assessment satu per satu hanya untuk mengecek siapa saja kandidat yang baru selesai interview hari ini.
- **Pencarian Kandidat Terfragmentasi**: Sulit mencari nama kandidat jika lupa di posisi mana ia melamar.
- **Tidak Ada Monitoring Global**: Tidak ada metrik terpusat yang memperlihatkan total kandidat yang sedang live atau menunggu giliran di seluruh perusahaan.

### 🛠️ Solusi & Implementasi Teknis

#### Backend (`api/`):
- **Endpoint**: `GET /api/v1/sessions` pada `api/app/controllers/api/v1/sessions_controller.rb`.
- **Eager Loading**: Menggunakan `includes(:assessment)` untuk menghindari query N+1.
- **Response Data**: Menyertakan `assessment_name`, `role_title`, dan `candidate_name` pada serialisasi JSON session.

#### Frontend (`web/`):
- **Halaman**: `web/src/pages/candidates/CandidateListPage.tsx` (Route: `/candidates`).
- **4 Kartu Metrik KPI Global**:
  1. `Total Candidates`: Total seluruh sesi kandidat yang pernah dibuat.
  2. `Completed`: Sesi wawancara yang telah selesai dinilai.
  3. `Live Now`: Sesi wawancara suara yang sedang aktif berlangsung secara realtime.
  4. `Awaiting`: Sesi yang tautannya sudah dibagikan namun belum dibuka oleh kandidat.
- **Filter & Pencarian Real-Time**:
  - Kolom pencarian instan (nama kandidat atau nama posisi lowongan).
  - Dropdown penyaring posisi lowongan (*Assessment Filter*).
  - Tab status sesi: `All Candidates`, `Completed`, `Live Now`, `Awaiting Start`, `Failed / Disconnected`.
- **Tombol Aksi Terintegrasi**:
  - `[ 📊 View Portfolio ➔ ]`: Langsung membuka laporan kompetensi hasil wawancara AI.
  - `[ 🎙️ Live Monitor ➔ ]`: Langsung masuk ke radar coverage AI untuk sesi yang sedang aktif.
  - `[ 📋 Copy Invite Link ]`: Menyalin link undangan sesi yang berstatus pending.
  - `[ 📜 View Transcript ]`: Membuka rekaman percakapan suara jika sesi gagal/terputus.
- **Navigasi Global**:
  - Desktop: Ditambahkan ke navbar `AssessorLayout.tsx`.
  - Mobile: Ditambahkan ke tab bottom bar `BottomNav.tsx`.

---

## 2. Fitur Quick Invite & Test Candidate Modal

### 🔍 Latar Belakang & Nilai Bisnis
HR atau Assessor sering kali ingin membuat link undangan kandidat secara cepat atau ingin melakukan **uji coba simulasi wawancara suara AI secara instan** tanpa harus berpindah-pindah menu.

### 🛠️ Implementasi
- **Tombol Aksi**: `[ + Undang / Test Kandidat ]` di pojok kanan atas halaman `/candidates`.
- **Modal Interaktif**:
  - Memilih assessment target via dropdown pencarian.
  - Memasukkan nama kandidat atau nama penguji (misal: *"Vika Ariyanti"* atau *"Simulasi Internal"*).
  - Backend API: Memanggil `POST /api/v1/assessments/:assessment_id/sessions` dengan parameter `candidate_name`.
- **Success State & 1-Click Test Launcher**:
  - Menampilkan URL sesi yang dibuat lengkap dengan tombol `[ 📋 Salin ]`.
  - Tombol **`[ 🚀 Mulai Test Sekarang ↗ ]`** yang langsung membuka sesi wawancara di tab baru, memungkinkan assessor langsung menguji respons suara AI secara instan.
  - Daftar kandidat di tabel otomatis ter-refresh.

---

## 3. Searchable Assessment Selector

### 🔍 Latar Belakang
Ketika sebuah perusahaan memiliki puluhan lowongan assessment aktif, dropdown `<select>` biasa menjadi sulit digunakan karena mengharuskan pengguna melakukan scroll panjang.

### 🛠️ Implementasi
- Dibuat komponen khusus **`SearchableAssessmentPicker`** pada modal pembuatan sesi:
  - Input pencarian real-time dengan auto-focus.
  - Saringan cepat berdasarkan kata kunci nama lowongan.
  - Menampilkan informasi pendukung seperti durasi waktu (`45m`).
  - Opsi terpilih ditandai dengan checkmark (`✓`) dan warna aksen brand.
  - Fallback empty state jika tidak ada lowongan yang cocok dengan kata kunci.

---

## 4. Smart History Back Navigation (`navigate(-1)`)

### 🔍 Latar Belakang & Masalah
Sebelumnya, beberapa tombol Back (`←`) di-hardcode menuju URL tertentu (misal selalu kembali ke `/assessments/:id/invite`). Hal ini mengakibatkan user yang membuka Portfolio atau Transkrip dari menu baru **`Candidates` (`/candidates`)** malah terlempar ke halaman detail assessment yang tidak mereka tuju.

### 🛠️ Solusi
Seluruh tombol Back diubah menggunakan stack riwayat browser React Router (`useNavigate()` ➔ `navigate(-1)`):
- **Portfolio Page** ([PortfolioPage.tsx](file:///Volumes/Lexar/rakamin/ai-interview-platform/web/src/pages/portfolio/PortfolioPage.tsx))
- **Transcript Page** ([TranscriptPage.tsx](file:///Volumes/Lexar/rakamin/ai-interview-platform/web/src/pages/transcript/TranscriptPage.tsx))
- **Live Monitor Page** ([LiveMonitorPage.tsx](file:///Volumes/Lexar/rakamin/ai-interview-platform/web/src/pages/monitor/LiveMonitorPage.tsx))
- **Fit/Gap Report Page** ([FitGapReportPage.tsx](file:///Volumes/Lexar/rakamin/ai-interview-platform/web/src/pages/fitgap/FitGapReportPage.tsx))
- **Assessment Invite & Form Pages** (`AssessmentInvitePage`, `AssessmentNewPage`, `AssessmentEditPage`, `VacancyNewPage`, `VacancyEditPage`)

Hasilnya: Pengguna selalu kembali ke halaman tempat mereka berasal secara alami dan konsisten.

---

## 5. Modernisasi UI Portfolio, Transkrip & Direct File Download

### 🔍 Latar Belakang
- Tampilan error saat audio wawancara tidak cukup sebelumnya menggunakan kotak merah kaku yang terkesan seperti crash sistem.
- Proses ekspor berkas (PDF & JSON) berisiko memicu error jika diklik saat data belum selesai di-generate oleh AI, serta proses download file belum otomatis memicu unduhan lokal di beberapa browser.

### 🛠️ Solusi & Pembaruan
1. **Informative Failure & Empty States**:
   - State kartu gagal/kosong didesain ulang dengan ilustrasi ikon, penjelasan bahwa data audio belum mencukupi (misal kandidat belum berbicara atau sesi terputus), serta tombol aksi alternatif (`Generate Ulang` dan `Periksa Transkrip`).
2. **Fungsionalitas Direct File Download**:
   - Menambahkan manipulasi DOM anchor (`document.body.appendChild(a)` & `removeChild`) pada `handleExport` dan `handleDownload` di Portfolio & Transcript page.
   - Penamaan berkas otomatis dan rapi: `Portfolio-[CandidateName]-Session-[ID].pdf`, `.json`, atau `Transcript-[CandidateName]-Session-[ID].txt`.
3. **Safety Auto-Disabled State**:
   - Tombol `[ 📥 Unduh PDF ]` dan `[ 📥 Unduh JSON ]` otomatis nonaktif (*disabled*) selama status generasi portofolio belum `complete` (mencegah error 422).
   - Menampilkan animasi status `[ ⏳ Unduh PDF... ]` saat berkas sedang diproses backend.

---

## 6. Sistem Paginasi Reusable (`PaginationControl`)

### 🔍 Latar Belakang
Daftar kandidat yang banyak berpotensi membuat halaman web memanjang tanpa batas dan menurunkan performa render browser.

### 🛠️ Implementasi
- Dibuat komponen `web/src/components/ui/pagination-control.tsx`:
  - Menghitung rentang data aktif: *"Menampilkan 1 - 5 dari X data"*.
  - Tombol **`[ ◀ Sebelumnya ]`**, nomor halaman dinamis dengan elipsis (`1 ... 4 5 6 ... 10`), dan **`[ Selanjutnya ▶ ]`**.
  - Auto-reset ke halaman `1` setiap kali filter status, pencarian nama, atau filter assessment diubah.
- **Penerapan**:
  - Global Candidates Page (`CandidateListPage.tsx`): dibatasi 5 data/halaman.
  - Detail Assessment Candidate List (`AssessmentInvitePage.tsx`): dibatasi 5 data/halaman.

---

## 7. Integrasi Brand Identity Resmi Rakamin

### 🔍 Pembaruan
Seluruh icon placeholder / generik telah diganti dengan **Logo Resmi Rakamin**:
- **Desktop Header Navbar** ([AssessorLayout.tsx](file:///Volumes/Lexar/rakamin/ai-interview-platform/web/src/components/layout/AssessorLayout.tsx))
- **Mobile Top Navigation**
- **Halaman Login Assessor** ([LoginPage.tsx](file:///Volumes/Lexar/rakamin/ai-interview-platform/web/src/pages/auth/LoginPage.tsx))
- **Halaman Onboarding & Live Wawancara Kandidat** ([InterviewPage.tsx](file:///Volumes/Lexar/rakamin/ai-interview-platform/web/src/pages/interview/InterviewPage.tsx))

---

## 8. Unified Session Hub (Tab-Based Layout)

### 🔍 Latar Belakang & Masalah
Sebelumnya, informasi sesi wawancara terpisah di route yang berbeda (`/portfolio`, `/fitgap`, `/transcript`). Assessor harus bolak-balik membuka menu terpisah dan tidak ada tombol yang mengarahkan langsung ke analisis fit/gap dari halaman hasil penilaian.

### 🛠️ Implementasi
- **3 Tab Terpadu** pada `PortfolioPage.tsx`:
  1. **`[ 📊 Evaluasi Skill ]`**: Kartu kompetensi, badge level L1–L5, bukti kutipan wawancara (*Evidence*), dan tombol penyesuaian nilai (*Override*).
  2. **`[ 🎯 Kecocokan Lowongan ]`**: Pemilih lowongan benchmark dengan `SearchableSelect`, tabel perbandingan skor target vs kandidat, narasi kultur perusahaan, dan rekomendasi perekrutan AI.
  3. **`[ 💬 Transkrip Percakapan ]`**: Rekaman dialog suara dua arah antara AI dan Kandidat dengan opsi unduh PDF dan teks.
- **Auto-Load & Quick Switch Badges**:
  - Menampilkan badge lowongan yang telah dianalisis (misal: `[ eee ✓ ] [ ccc ]`).
  - Mengklik badge langsung menampilkan hasil analisis tanpa memicu kalkulasi ulang ke AI.

---

## 9. Komponen Live Searchable Select (Combobox)

### 🔍 Implementasi (`web/src/components/ui/searchable-select.tsx`)
- Menggantikan elemen `<select>` native dengan Combobox interaktif.
- Fitur:
  - Kolom pencarian instan dengan auto-focus.
  - Menampilkan deskripsi pelengkap (misal: *45 mins • 1 skills*).
  - Checkmark terpilih (`✓`) dan tombol *Clear* (`✕`) untuk reset.
  - Diterapkan pada filter lowongan di halaman **Candidates** (`/candidates`) dan pemilih benchmark **Fit/Gap**.

---

## 10. Modal Popup Override Rating & Kotak Audit Trail

### 🔍 Implementasi
- **Dialog Modal Popup** ([OverridePanel.tsx](file:///Volumes/Lexar/rakamin/ai-interview-platform/web/src/components/portfolio/OverridePanel.tsx)):
  - Menampilkan perbandingan skor asli AI dan tingkat keyakinan (*Confidence*).
  - Pemilih level baru L1–L5 yang responsif.
  - Textarea **Alasan & Catatan Penyesuaian (*Assessor Notes*)**.
- **Kotak Jejak Audit (*Audit Trail Box*)** ([SkillPortfolioCard.tsx](file:///Volumes/Lexar/rakamin/ai-interview-platform/web/src/components/portfolio/SkillPortfolioCard.tsx)):
  - Menampilkan banner: `Penyesuaian Manual Assessor: Level L1 (AI) ➔ Level L2`.
  - Dilengkapi waktu penyesuaian (misal: *15 Agu 2026, 07:44*) dan kutipan catatan assessor.
  - Catatan assessor otomatis tercetak ke dalam dokumen PDF resmi ([pdf_generator.rb](file:///Volumes/Lexar/rakamin/ai-interview-platform/api/app/services/exports/pdf_generator.rb)).

---

## 11. Auto-Download PDF Tanpa Buka Tab Baru

### 🔍 Implementasi
- Menggunakan teknik *Hidden Iframe Direct Print/Save* pada halaman Transkrip ([TranscriptPage.tsx](file:///Volumes/Lexar/rakamin/ai-interview-platform/web/src/pages/transcript/TranscriptPage.tsx)).
- Mengunduh atau mencetak PDF transkrip dialog secara instan di tab yang sama tanpa membuka tab baru yang mengganggu alur kerja pengguna.

---

## 12. Lokalisasi Penuh Bahasa Indonesia (Prompt Gemini 3.5 Flash & UI)

### 🔍 Implementasi
- **AI Generator Prompts**:
  - `api/app/services/portfolios/generator.rb`: Prompt Gemini menghasilkan `competency_summary` dalam Bahasa Indonesia profesional jika assessment disetel ke bahasa `id`.
  - `api/app/services/fit_gap/engine.rb`: Prompt Gemini menghasilkan `culture_narrative` dan `overall_narrative` dalam Bahasa Indonesia profesional.
- **Tombol `[ 🔄 Evaluasi Ulang AI ]`**: Memungkinkan assessor memperbarui hasil evaluasi sesi lama ke Bahasa Indonesia dengan 1-klik cepat.
- **Penyeragaman Terminologi HR Indonesia**:
  - `Evaluasi Skill` (menggantikan *Portofolio Skill*).
  - `Kecocokan Lowongan` (menggantikan *Analisis Fit/Gap*).
  - `Bukti Kutipan Wawancara` (menggantikan *Evidence from interview*).
  - `Ringkasan Kompetensi AI` (menggantikan *Competency summary*).

---

## 13. Indikator Jumlah Kandidat pada Kartu Assessment

### 🔍 Implementasi
- **Backend Serializer**: Menambahkan `candidates_count: assessment.sessions.size` pada serialisasi `assessment_json` di `AssessmentsController`.
- **Frontend Header**: Menampilkan badge jumlah kandidat terdaftar pada setiap kartu di halaman `/assessments` (misal: `👥 14 kandidat`).

---

## 14. Penguncian Bahasa Transkripsi Suara (ASR Language Pinning Directive)

### 🔍 Masalah & Implementasi
- **Masalah**: Model Speech-to-Text Gemini Live yang bersifat multibahasa global terkadang mengalami ambiguitas fonetik pada suara bervolume rendah atau desis mikrofon di awal sesi, secara keliru menebak audio Indonesia menjadi aksara asing (Hangul Korea / Prancis).
- **Implementasi**: Menambahkan aturan *Language Pinning Directive* pada `SystemPromptCompiler` yang memaksa ASR Gemini untuk secara ketat menginterpretasikan dan mentranskripsikan ucapan kandidat hanya ke dalam Bahasa Indonesia dan istilah teknis Latin standar.

---

## 🧪 Status Uji & Verifikasi
- **Frontend Vitest**: `25/25` test passing (`npm test -- --run`).
- **Production Build**: `tsc` & `vite build` selesai sukses tanpa error (`npm run build`).
- **Backend RSpec**: `64/64` examples passing (`bundle exec rspec`).
