# Step 4: Revamp Strategy, Acceptance Criteria & Trade-offs

## 1. Self-Defined Acceptance Criteria (Sebelum Penulisan Kode)

Sebelum mengimplementasikan perubahan kode, kriteria keberhasilan (*acceptance criteria*) ditetapkan secara ketat untuk setiap input dan kasus batas (*edge case*):

### AC-01: Penanganan Skill yang Belum Dinilai (*Unassessed Skills*)
- **Kondisi**: Lowongan (*vacancy*) mewajibkan skill X, namun sesi wawancara tidak sempat menilai skill X (misal karena waktu habis atau di luar konfigurasi asesmen).
- **Perilaku yang Benar**:
  - Backend `FitGap::Engine` secara eksplisit menghasilkan record dengan `result: 'not_assessed'`, `candidate_level: nil`, `expected_level: <target>`, dan `delta: nil`.
  - Frontend `ComparisonTable` menampilkan status badge "Not Assessed" dengan warna netral/peringatan yang jelas, bukan sekadar simbol kosong `—`.
  - Narasi evaluasi keseluruhan (*overall narrative*) menyertakan klausul transparan bahwa skill terkait belum teruji sehingga membutuhkan konfirmasi pada wawancara tatap muka.

### AC-02: Ketahanan terhadap Kegagalan Panggilan Model AI (*Model Call Failures & Timeouts*)
- **Kondisi**: Layanan Gemini mengembalikan error HTTP (429/500), timeout jaringan (>30 detik), atau format JSON rusak (*malformed payload*).
- **Perilaku yang Benar**:
  - `Portfolios::Generator` menangkap `Gemini::Error` dan `JSON::ParserError` secara terisolasi.
  - Jika format JSON tidak valid, parser mencoba melakukan sanitasi markdown (membersihkan ````json ... ````). Jika tetap gagal, status portfolio diperbarui menjadi `failed` dengan pesan ramah pengguna tanpa membocorkan stack trace internal.
  - `FitGap::Engine` memiliki *deterministic rule-based fallback narrative*: jika Gemini Flash gagal menghasilkan teks narasi budaya, sistem secara otomatis merangkum perbandingan matematis (jumlah match, exceed, gap) sehingga laporan tetap dapat diterbitkan.
  - Status record tidak pernah menggantung (*hung*) dalam status `generating`.

### AC-03: Perlindungan Duplikasi Eksekusi (*Idempotency & Concurrency*)
- **Kondisi**: Asesor mengklik tombol "Regenerate Fit/Gap" atau "Regenerate Portfolio" berkali-kali secara cepat.
- **Perilaku yang Benar**:
  - Endpoint REST menolak permintaan kedua jika status saat ini masih `generating` (mengembalikan HTTP 409 Conflict atau 422 Unprocessable Entity dengan pesan yang jelas).
  - Background worker (`PortfolioGeneratorWorker` dan `FitGapGeneratorWorker`) memverifikasi status sebelum memulai komputasi berat, mencegah penulisan ganda (*double writes*).

### AC-04: Penanganan Data Teks Panjang (*Long Text States & Typography Rigor*)
- **Kondisi**: Ringkasan kompetensi (*competency summary*) memiliki panjang 4–6 paragraf, atau kutipan transkrip sangat panjang.
- **Perilaku yang Benar**:
  - Kartu portofolio di frontend menerapkan layout adaptif dengan fitur expand/collapse yang mulus, mencegah layout terdistorsi pada layar mobile maupun desktop.
  - Generator PDF (`Exports::PdfGenerator`) menerapkan pembagian halaman (*page breaks*) yang aman dan batas lebar tabel proporsional, mencegah teks meluap (*overflow*) ke luar margin dokumen A4.

### AC-05: Kepatuhan UU PDP (Data Protection & Log Sanitization)
- **Kondisi**: Logging pada WebSocket dan REST Controller saat memproses percakapan kandidat.
- **Perilaku yang Benar**:
  - Tidak ada rekaman transkrip mentah, token JWT otentikasi, atau nomor identitas kandidat yang ditulis ke log Rails (`log/development.log` atau `log/production.log`).
  - Log hanya mencatat metadata operasional: `session_id`, `turn_number`, durasi, dan kode status.

---

## 2. Evaluasi Opsi Solusi & Analisis Trade-offs

Dua opsi arsitektural dianalisis secara komprehensif untuk menentukan arah revamp:

### Option A: Complete Real-Time Architecture Overhaul
- **Deskripsi**: Merombak total seluruh alur state coverage dan portfolio generator menjadi event-driven streaming murni menggunakan Redis Streams / ActionCable terpusat, dengan kalkulasi live fit/gap setiap pergantian turn wawancara.
- **Product Impact vs Cost**: Memberikan pengalaman *instant live matching*, tetapi biaya rekayasa (*engineering cost*) sangat tinggi dan berisiko merusak stabilitas faye-websocket yang sudah berjalan.
- **Failure Modes**: Jika Gemini Flash mengalami delay di tengah percakapan, beban agregasi event real-time akan meningkatkan latensi audio loop.
- **Maintainability**: Kompleksitas tinggi; sulit di-debug di lingkungan lokal tanpa infrastruktur streaming lengkap.

### Option B: Monozukuri Precision Revamp & Seam Hardening (Pilihan Terpilih)
- **Deskripsi**: Mempertahankan arsitektur decoupled yang ada (Faye-WS untuk audio, Sidekiq untuk background synthesis, REST untuk report viewing), namun **memperkuat secara radikal seluruh titik sambungan (*seam*)**, menambahkan *fault tolerance* berlapis, menyempurnakan interaksi UI/UX dengan estetika premium, dan melengkapi testing harness otomatis (RSpec + Vitest).
- **Product Impact vs Cost**: Rasio dampak terhadap biaya tertinggi. Menyelesaikan masalah P0 dan P1 yang nyata tanpa menambah dependensi liar yang tidak diperlukan.
- **Failure Modes**: Terisolasi dengan baik. Kegagalan pada satu modul (misal LLM fit/gap narrative) tidak merusak data inti perbandingan level yang berbasis aturan matematis (*rule-based comparison*).
- **Maintainability**: Kode bersih, mudah dipahami oleh tim baru, dan dapat dibalikkan (*roll back*) dengan mudah jika diperlukan.

---

## 3. Matriks Perbandingan Keputusan Arsitektur

| Dimensi Evaluasi | Option A (Total Overhaul) | Option B (Monozukuri Precision Revamp) | Rationale Pilihan (Option B) |
|---|---|---|---|
| **Product Impact** | Sangat tinggi, tetapi berlebih untuk kebutuhan utama asesor | **Tinggi & Tepat Sasaran**; fokus pada kepastian data, transparansi, dan estetika visual | Pengguna membutuhkan laporan yang terpercaya dan tidak error saat dipresentasikan. |
| **Engineering Cost** | Sangat mahal (butuh refactor menyeluruh 2 service) | **Terkontrol & Proporsional** dalam tenggat waktu | Memungkinkan alokasi waktu untuk automated test suite lengkap. |
| **Failure Modes** | Latensi audio terancam jika pipeline streaming macet | **Graceful Fallbacks**; fallback deterministik saat LLM gagal | Menjamin kandidat tidak dirugikan oleh kegagalan infrastruktur eksternal. |
| **Long-Term Evolution**| Arsitektur terlampau rumit (*over-engineered*) | **Modular & Teruji** dengan RSpec dan Vitest | Memudahkan onboarding insinyur baru sesuai prinsip *Clean Code*. |
| **Contextual Fit** | Rendah untuk deadline dan repositori saat ini | **Sempurna**; menghormati codebase yang ada dan mengangkatnya ke standar tertinggi | Memenuhi definisi Monozukuri: *Pride in Making, Great UI/UX Taste, System Rigor*. |
