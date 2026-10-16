# Revamp Strategy & Acceptance Criteria: AI Interview Platform

Dokumen ini memuat perancangan strategi perbaikan (*revamp strategy*), analisis perbandingan opsi arsitektur, kriteria penerimaan (*acceptance criteria*), serta matriks skenario pengujian komprehensif untuk satu peningkatan berdampak nyata yang menyentuh modul backend dan frontend.

---

## 1. Pemilihan Peningkatan Berdampak Nyata

### 1.1 Judul Peningkatan
**"Resilient, Audit-Compliant Assessment Reporting & Export Subsystem"**
*(Penguatan Keandalan Subsistem Pelaporan & Ekspor Portofolio Kandidat dengan Normalisasi UTF-8 Universal, Tenant-Scoped Security, dan Resilient Client-Side Export UX)*

### 1.2 Latar Belakang Masalah
Pada investigasi sebelumnya (**ISSUE-02**, tingkat keparahan **P0**):
- Modul backend `Exports::PdfGenerator` mengalami *fatal unhandled exception* (`Prawn::Errors::IncompatibleStringEncoding`) saat mencetak dokumen PDF yang memuat karakter Unicode non-Windows-1252 (seperti tanda panah `→` pada override nilai asesor, tanda bullet `•`, petik lengkung pada transkrip, maupun aksen nama kandidat).
- Modul frontend (`PortfolioPage.tsx` dan `FitGapReportPage.tsx`) tidak memiliki penanganan error yang memadai saat request ekspor berstatus gagal:
  - Axios disetel dengan `responseType: "blob"`. Ketika backend melempar HTTP 500 atau 422, respons error berbentuk Blob JSON yang tidak diurai (*unparsed*), tombol kembali ke keadaan diam tanpa umpan balik (*silent failure*), dan pengguna tidak mengetahui penyebab kegagalan.
  - Tidak ada indikasi visual kegagalan jaringan atau peringatan ketika portofolio belum berstatus `complete`.

### 1.3 Ruang Lingkup Modul yang Diubah
1. **Modul Backend**:
   - `api/app/services/exports/pdf_generator.rb`: Normalisasi encoding multi-bahasa universal (UTF-8 to Windows-1252 safe-mapping dengan transliterasi simbolik), penanganan *null safety* pada metadata sesi/vacancy, serta layout styling PDF yang presisi.
   - `api/app/controllers/api/v1/portfolios_controller.rb`: Validasi status portofolio sebelum ekspor, verifikasi kepemilikan tenant (`tenant_id`), dan penanganan format yang konsisten.
2. **Modul Frontend**:
   - `web/src/pages/portfolio/PortfolioPage.tsx`: Komponen error boundary ekspor, parsing pesan error dari respons Blob, *action feedback* (toast/alert dialog saat gagal), dan tombol aksi yang responsif.
   - `web/src/pages/fitgap/FitGapReportPage.tsx`: Penyelarasan penanganan ekspor PDF/JSON serupa pada halaman komparasi Fit/Gap.
   - `web/src/services/portfolios.ts`: Penanganan error response blob-to-json transformer.

---

## 2. Perbandingan Pilihan Solusi (*Trade-Off Analysis*)

Untuk menyelesaikan masalah subsistem pelaporan ini, dibandingkan 3 pendekatan alternatif:

| Dimensi Evaluasi | Opsi 1: External TTF Font Embedding (Noto Sans / DejaVu) | Opsi 2: High-Performance Universal Transliteration & Sanitization Engine (Dipilih) | Opsi 3: Headless Chromium PDF Generation (Puppeteer / Grover) |
|---|---|---|---|
| **Deskripsi Solusi** | Memasukkan file font `.ttf` (misal Google Noto Sans) ke dalam repositori dan meregistrasikannya ke Prawn font registry. | Membangun layer transliterasi cerdas di `PdfGenerator` yang memetakan karakter Unicode, simbol matematika, aksen, dan tanda baca ke representasi visual tipografi standar AFM 1252 secara aman, dipadu dengan proteksi *rescue encoding*. | Mengganti Prawn dengan browser headless berbasis HTML-to-PDF template (Puppeteer/Grover). |
| **Manfaat (*Benefits*)** | Mendukung render karakter non-Latin eksotik secara natif. | • **Nol ketergantungan binary/font eksternal**: Berjalan instan di seluruh OS (Windows/Linux/macOS) tanpa menambah ukuran bundle.<br>• Kecepatan render sangat tinggi (< 50ms per PDF).<br>• Konsistensi deterministik dan memori hemat. | Layout PDF bisa didesain menggunakan CSS HTML modern. |
| **Biaya (*Costs*)** | Menambah ukuran repositori ~15MB (font file) dan lisensi font SIL Open Font License. | Biaya implementasi logika pemetaan regex komprehensif di Ruby. | Sangat tinggi: butuh instalasi Node.js + Chromium di container backend Rails (menambah image Docker ~400MB dan konsumsi RAM besar). |
| **Pemeliharaan (*Maintainability*)** | Perlu mengelola path aset font lintas environment (relatif vs absolut di Docker/Windows). | Sangat mudah: murni kode Ruby standard library (`Prawn`, `String#encode`), terisolasi dalam satu service class. | Kompleks: dependensi binary browser headless sering bermasalah saat patch OS dan konsumsi thread berat. |
| **Risiko Kegagalan (*Failure Risks*)** | Crash jika file font corrupt atau path tidak ditemukan di production pod. | Sangat rendah: menggunakan pendekatan *defense-in-depth* (transliterasi pemetaan -> fallback replacement karakter yang tidak dikenal -> zero exception). | Risiko timeout tinggi jika Chromium process hang atau kehabisan memori (*OOM killer*). |
| **Kesesuaian Codebase (*Codebase Fit*)** | Cukup baik, tetapi memerlukan perubahan bundler asset pipeline. | **Sangat Sempurna**: Sesuai dengan arsitektur Rails API murni yang sudah menggunakan gem `prawn` dan `prawn-table`. | Buruk: mengubah paradigma arsitektur rendering dokumen secara drastis. |

### Alasan Memilih Opsi 2:
Opsi 2 memberikan **dampak maksimal dengan risiko regresi minimal**. Sistem rekrutmen profesional memerlukan kecepatan cetak laporan yang andal, tanpa membebani runtime container dengan dependensi eksternal, dan tahan terhadap input teks apa pun yang diucapkan oleh kandidat (termasuk emoji, tanda kutip kurva, dan simbol panah override).

---

## 3. Kriteria Penerimaan (*Acceptance Criteria*)

### 3.1 Kondisi yang Dianggap Benar (*Happy Path / Normal Conditions*)
1. **Ekspor Portofolio Tunggal (PDF & JSON)**:
   - Pengguna mengklik tombol "PDF" pada halaman `/assessments/:id/sessions/:sessionId/portfolio`.
   - File `portfolio-<sessionId>.pdf` terunduh secara otomatis. Dokumen memuat:
     - Header: Nama Asesmen, ID Sesi, durasi wawancara, dan tanggal cetak.
     - Bagian Portofolio: Daftar keahlian terkonfigurasi (*Configured Skills*) dan keahlian baru yang ditemukan (*Discovered Skills*).
     - Tiap keahlian menampilkan: Label Keahlian, Level Efektif (misal L4 Advanced), status Override (jika ada: `AI: L3 -> Override: L4`), indikator keyakinan (High/Medium/Low), rangkuman kompetensi, serta kutipan verbatim kandidat (*Evidence*).
     - Garis pemisah bersih antar kartu keahlian dan nomor halaman di footer.
   - Pengguna mengklik tombol "JSON", file `portfolio-<sessionId>.json` terunduh dengan struktur data lengkap.
2. **Ekspor Fit/Gap Report Terpadu (PDF & JSON)**:
   - Pengguna memilih Vacancy dan mengklik tombol "PDF" pada halaman Fit/Gap.
   - Dokumen PDF memuat bagian portofolio ditambah halaman baru (*page break*) berisi:
     - Judul: `Fit/Gap Analysis - <Role Title>`.
     - Tabel Komparasi: Kolom Skill, Required Level, Candidate Level, Result (`Match`, `Gap`, `Exceeds`, `Not Assessed`), dan Delta.
     - Paragraf Narasi: *Culture & Competency Fit* dan *Overall Assessment*.

### 3.2 Kondisi Saat Data Tidak Lengkap (*Incomplete / Edge Cases Data*)
1. **Kandidat Belum Memiliki Catatan Override**:
   - Jika keahlian tidak di-override, PDF hanya menampilkan `Level: L<ai_level> | Confidence: <confidence>` tanpa tulisan panah atau override.
2. **Kandidat Tanpa Evidence Quotes (Probe Minimum)**:
   - Jika array `evidence` kosong, bagian *"Evidence:"* disembunyikan secara rapi tanpa meninggalkan whitespace berlebih.
3. **Vacancy Tanpa Culture / Competency Dimensions**:
   - Jika Vacancy tidak memiliki teks narasi kultur, tabel perbandingan keahlian tetap tercetak secara sempurna dan paragraf yang kosong dilewati secara elegan.
4. **Sesi Tanpa Durasi (*In-Flight / Interrupted Sessions*)**:
   - Jika `duration_seconds` bernilai `nil`, header menampilkan `Duration: -` (bukan error perkalian waktu).
5. **Kandidat Tanpa Nama Terdaftar**:
   - Jika `candidate_name` kosong, sistem menggunakan fallback `Candidate <session_id>` secara konsisten.

### 3.3 Respons Aplikasi Saat Terjadi Kegagalan (*Failure Modes & Resilience*)
1. **Kegagalan Backend (Internal Error / Timeout)**:
   - Jika backend merespons status non-200 (misal 500, 502, atau 404):
     - Frontend **tidak boleh diam tanpa respon**.
     - Tombol ekspor kembali dari keadaan loading (*disabled false*).
     - Frontend mengurai isi pesan error (meskipun bertipe respons Blob) dan menampilkan alert dialog/banner merah ramah pengguna: *"Failed to download report: <error_message>. Please try again."*
2. **Portofolio Belum Selesai (*Incomplete Generation Status*)**:
   - Jika status portofolio masih `generating` atau `pending`, backend merespons HTTP 422: `{"errors":[{"status":422,"message":"Portfolio is not ready for export (status: generating)"}]}`.
   - Frontend menampilkan status non-aktif dengan tooltip penjelasan.
3. **Karakter Unicode Tak Dikenal (*Exotic Glyphs / Emoji*)**:
   - Jika transkrip mengandung karakter emoji atau simbol asing di luar pemetaan standar, mesin normalisasi backend secara aman menggantinya dengan karakter representatif atau tanda tanya pengganti `?` (*lossless fallback*), dan PDF **tetap berhasil dibuat tanpa pernah melempar exception**.

---

## 4. Daftar Skenario Pengujian (*Test Scenarios*)

| ID Tes | Kategori | Skenario Pengujian | Langkah Pengujian | Hasil yang Diharapkan |
|:---:|:---:|:---|:---|:---|
| **TC-01** | Backend Unit | Normalisasi Unicode Tanda Baca Khusus | Panggil `clean_str` dengan teks memuat `→`, `•`, `—`, `“`, `”`, `‘`, `’`. | Teks terkonversi menjadi `->`, `-`, `-`, `"`, `"`, `'`, `'` dengan encoding Windows-1252 valid. |
| **TC-02** | Backend Unit | Ketahanan terhadap String Nil & Non-String | Panggil `clean_str(nil)` dan `clean_str(12345)`. | Mengembalikan string kosong `""` dan `"12345"` tanpa TypeError. |
| **TC-03** | Backend Integration | Render PDF dengan Override Assessor Aktif | Instansiasi `PdfGenerator` pada portfolio yang memiliki `AssessorOverride`. | PDF binary terhasilkan (`start_with?("%PDF-")`), ukuran byte > 0, memuat teks level override. |
| **TC-04** | Backend Integration | Render PDF Lengkap dengan Fit/Gap Report | Instansiasi `PdfGenerator` dengan menyertakan objek `Vacancy` dan `FitGapReport`. | Halaman kedua terbentuk, memuat tabel Prawn Table dengan 5 kolom komparasi dan narasi AI. |
| **TC-05** | Backend Request | Akses Endpoint Ekspor Format PDF yang Valid | `GET /api/v1/portfolios/:id/export?format=pdf&vacancy_id=1` dengan header JWT sah. | HTTP 200 OK, `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="portfolio-1.pdf"`. |
| **TC-06** | Backend Request | Akses Endpoint Ekspor Format JSON | `GET /api/v1/portfolios/:id/export?format=json&vacancy_id=1` dengan header JWT sah. | HTTP 200 OK, `Content-Type: application/json`, payload memuat objek `portfolio` dan `fit_gap_report`. |
| **TC-07** | Backend Security | Proteksi Ekspor Portofolio Organisasi Lain (Tenant Boundary) | Request ekspor portofolio milik tenant B menggunakan token milik tenant A. | HTTP 404 Not Found / 403 Forbidden; tidak ada data yang bocor lintas tenant. |
| **TC-08** | Backend Validation | Percobaan Ekspor Portofolio yang Belum Selesai | Request ekspor pada portofolio dengan `generation_status: 'generating'`. | HTTP 422 Unprocessable Entity dengan pesan deskriptif. |
| **TC-09** | Frontend E2E | Unduh PDF Langsung dari Halaman Portfolio | Klik tombol "PDF" pada UI `/assessments/:id/sessions/:sessionId/portfolio`. | Tombol menampilkan spinner loading sejenak, browser memicu download file `portfolio-<id>.pdf`. |
| **TC-10** | Frontend E2E | Unduh JSON Langsung dari Halaman Portfolio | Klik tombol "JSON" pada UI Portfolio. | Browser memicu download file `portfolio-<id>.json` dengan format indented JSON valid. |
| **TC-11** | Frontend Error Handling | Penanganan Kegagalan Jaringan / 500 saat Ekspor | Simulasikan backend mengembalikan HTTP 500 saat klik PDF. | Muncul modal/toast pesan error yang dapat dibaca manusia; tombol kembali aktif dan dapat dicoba ulang. |
| **TC-12** | Frontend Edge Case | Tombol Ekspor Disabled saat Portofolio Generating | Buka halaman portfolio sesi yang sedang berjalan. | Tombol PDF dan JSON dalam kondisi disabled atau menampilkan tooltip penjelasan. |

---

## 5. Rencana Penerapan (*Execution Plan*)

1. **Langkah 1 (Backend)**:
   - Sempurnakan method `clean_str` dan arsitektur sanitasi di `app/services/exports/pdf_generator.rb`.
   - Pastikan setiap blok teks (`render_header`, `render_skill_card`, `render_fit_gap_section`) terlindungi oleh sanitasi encoding.
   - Tambahkan RSpec spec di `api/spec/services/exports/pdf_generator_spec.rb` untuk memvalidasi kasus uji TC-01 s.d. TC-04 secara otomatis.
2. **Langkah 2 (Frontend)**:
   - Modifikasi `handleExport` di `PortfolioPage.tsx` dan `FitGapReportPage.tsx` agar memiliki blok `try...catch` yang mengurai respons error Blob (`await (error.response.data as Blob).text()`).
   - Tampilkan alert error banner jika ekspor gagal.
3. **Langkah 3 (Verifikasi End-to-End)**:
   - Uji langsung via browser otomatisasi terhadap sesi kandidat riil di database lokal.
   - Verifikasi integritas file PDF hasil unduhan.
