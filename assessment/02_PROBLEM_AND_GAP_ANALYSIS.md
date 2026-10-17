# Step 3: Defining Problem & Gap to Ideal Condition

## 1. Problem Statement Inti
Platform saat ini memiliki fondasi arsitektur multimodal yang canggih (integrasi Gemini Live WebSocket, Faye-WebSocket, dan pelacakan StateEngine), namun **mengalami celah reliabilitas komputasi dan ketahanan kegagalan (*failure paths*) yang rentan**, serta **kontras penyajian (*presentation seam*) yang belum sepenuhnya siap produksi**. 

Ketika terjadi kegagalan eksternal (misal model LLM timeout, pemutusan jaringan mendadak, atau data tak terduga seperti unassessed skills), sistem rentan masuk ke status menggantung (*stuck in generating/active*), membeberkan log data sensitif kandidat, atau merusak pengalaman pengambilan keputusan bagi asesor dan hiring manager.

---

## 2. Severity-Ranked Findings (P0 s.d. P3)

| Severity | ID | Area | One-Line Impact Statement |
|---|---|---|---|
| **P0** | F-01 | Backend / Reliability | *Timeout atau kegagalan API model pada Portfolio Generator dan FitGap Generator menyebabkan session terkunci selamanya dalam status `generating` tanpa mekanisme fallback atau retry yang terstruktur.* |
| **P0** | F-02 | Backend / Compliance | *Log backend pada WebSocket middleware berpotensi mengekspos transkrip mentah dan parameter koneksi yang melanggar mandat UU PDP terkait pemrosesan data pribadi.* |
| **P1** | F-03 | API-Web Seam / Logic | *Ketika vacancy memiliki skill yang tidak dinilai dalam sesi wawancara, kalkulasi Fit/Gap menghasilkan `result: not_assessed` yang tidak memiliki visual badge atau penanganan panduan rekomendasi yang jelas di frontend.* |
| **P1** | F-04 | Backend / Concurrency | *Pemicuan ulang Fit/Gap (`regenerate_fitgap`) dan Portfolio (`regenerate`) tidak memiliki lock idempotency, sehingga klik ganda pada UI dapat memicu worker Sidekiq duplikat yang menimpa hasil secara bersamaan.* |
| **P1** | F-05 | Frontend / Resilience | *Halaman FitGapReportPage dan PortfolioPage mengalami layar kosong atau loop polling tak berujung jika request backend mengembalikan status 500 atau payload parsial.* |
| **P2** | F-06 | Frontend / UX Polish | *Ringkasan kompetensi (*competency summary*) dan kutipan bukti (*evidence quotes*) yang sangat panjang memecah kerapian grid layout kartu portofolio dan tidak memiliki mekanisme expand/collapse yang elegan.* |
| **P2** | F-07 | Frontend / Interaction | *Feedback saat asesor menyimpan nilai override atau memicu generate fit/gap minim indikator transisi yang memukau, membuat asesor ragu apakah aksi mereka telah tersimpan.* |
| **P3** | F-08 | Backend / Data Model | *Tidak adanya validasi konsistensi antara `skill_id` pada taxonomy standar B7 dengan skill kustom pada level vacancy_skills memungkinkan adanya orphaned label matching.* |

---

## 3. Klasifikasi: Defective Implementation vs Missing Specification

### A. Defective Implementation (Telah Didefinisikan tapi Rusak/Rentan)
1. **Error Handling & State Recovery pada Generator (`Portfolios::Generator` & `FitGap::Engine`)**:
   - *Defek*: Ketika exception terjadi, record portfolio diperbarui menjadi `failed`, namun tidak ada otomatisasi alerting atau fallback narrative yang adil jika LLM hanya gagal parsial pada formatting JSON.
   - *Seam*: Frontend polling mendeteksi `failed`, namun tombol regenerate terbatas dan tidak memberikan instruksi pemulihan yang informatif kepada pengguna.
2. **Sidekiq Worker Duplicate Queueing (`FitGapGeneratorWorker`)**:
   - *Defek*: Worker dieksekusi secara asinkron tanpa *unique job lock* atau atomic state check. Panggilan beruntun dari REST endpoint menyebabkan balapan tulis (*race condition*) pada tabel `fit_gap_reports`.
3. **Prown PDF Generation Padding & Overflow (`Exports::PdfGenerator`)**:
   - *Defek*: Teks kutipan bukti yang panjang menyebabkan sel tabel terpotong atau menimbulkan page break yang canggung di tengah blok kompetensi.

### B. Missing Specification (Belum Didefinisikan dalam Desain Awal)
1. **Handling untuk Discovered Skills pada Fit/Gap Analysis**:
   - *Kondisi*: PRD 01 mendefinisikan AI dapat menemukan skill di luar agenda (*discovered skills*). Namun, spesifikasi pencocokan vacancy tidak pernah mendefinisikan apakah *discovered skills* boleh ditambahkan sebagai nilai tambah (*bonus credentials*) ke dalam laporan fit/gap atau hanya dibiarkan di portofolio umum.
2. **Sanitasi Logging UU PDP (Data Protection by Design)**:
   - *Kondisi*: Belum ada aturan filter log spesifik di `config/environments/` untuk memotong teks transkrip percakapan kandidat saat mode debug/info aktif.
3. **Graceful Degradation saat Koneksi Audio Terputus di Tengah Sesi**:
   - *Kondisi*: Aturan penanganan ketika kandidat mengalami gangguan koneksi internet di menit ke-20 tanpa sempat menyelesaikan seluruh skill: apakah portofolio digenerate dengan penanda `partial_evaluation` atau sesi ditandai `aborted`?

---

## 4. Analisis Seam (Komputasi Data vs Presentasi Frontend)

```
┌──────────────────────────────────────┐          ┌──────────────────────────────────────┐
│       Backend (Ruby on Rails)        │          │          Frontend (React 18)         │
├──────────────────────────────────────┤          ├──────────────────────────────────────┤
│ FitGap::Engine:                      │          │ ComparisonTable.tsx:                 │
│ - Menghitung delta level (-1, 0, +1) │  JSON    │ - Merender baris tabel               │
│ - Status: match, gap, exceed,        │ ───────> │ - Butuh visualisasi badge kontras    │
│   not_assessed                       │ Payload  │ - Butuh empty/error fallback         │
│ - Menghasilkan culture_narrative     │          │ - Butuh sorting/filtering kompetensi │
│ - Menghasilkan overall_narrative     │          │ - Butuh micro-animation perubahan    │
└──────────────────────────────────────┘          └──────────────────────────────────────┘
```

**Temuan Celah pada Seam**:
1. Jika kandidat memiliki skill yang berstatus `not_assessed`, backend mengirimkan `candidate_level: null` dan `delta: null`. Komponen frontend `ComparisonTable.tsx` menampilkan strip datar `—` tanpa memberikan penjelasan apakah skill tersebut dilewati karena keterbatasan waktu atau memang tidak diujikan.
2. Saat asesor melakukan override pada level portofolio, backend menyimpan perubahan di tabel `assessor_overrides`, namun laporan Fit/Gap yang sudah terlanjur digenerate sebelumnya tidak otomatis diperbarui kecuali asesor menekan tombol regenerate secara manual.

---

## 5. Constraint Signal (Eskalasi ke Technical Lead)

Berikut adalah risiko arsitektural dan dependensi kritis yang harus dieskalasi ke Technical Lead pada proyek nyata:
1. **Ketergantungan Kuota & Latensi Gemini API**:
   - *Risiko*: Operasi `Gemini::LiveClient` dan `Gemini::HttpClient` sangat bergantung pada ketersediaan API Google AI Studio. Kegagalan rate limit (HTTP 429) atau timeout pada koneksi WebSocket audio dapat menghentikan wawancara secara mendadak.
   - *Rekomendasi Eskalasi*: Implementasi circuit breaker dan fallback audio recording buffer lokal agar sesi wawancara dapat diselesaikan secara offline dan ditranskripsi ulang secara asinkron (*graceful offline fallback*).
2. **Kepatuhan Data Kedaulatan (UU PDP Pasal 56)**:
   - *Risiko*: Streaming audio ke server Gemini yang berlokasi di luar yurisdiksi Indonesia membutuhkan klausul persetujuan eksplisit (*explicit consent*) dan kepastian standar pelindungan data setara.
   - *Rekomendasi Eskalasi*: Memastikan klausul consent muncul di layar `HardwareCheck` sebelum izin mikrofon dibuka oleh browser.
