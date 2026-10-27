# Section 05: Video Walkthrough Script & Live Defense Guide

**Presenter**: Wisman Nur (Lead / Senior Staff Product Engineer)  
**Target Duration**: 3 – 5 Minutes  
**Format**: Loom / YouTube Unlisted / Video Recording for Rakamin Submission  
**Target Branch**: `feat/monozukuri-interview-revamp-wismannur`  
**Date**: October 2026  

---

## 1. Persiapan Sebelum Merekam (Pre-Recording Checklist)

Sebelum menekan tombol **Record**, pastikan environment lokal dalam kondisi prima:

1. **Jalankan Backend Rails API**:
   ```bash
   cd api && bin/rails s -p 3001
   ```
2. **Jalankan Frontend React (Vite)**:
   ```bash
   cd web && npm run dev
   ```
   *(Frontend aktif di `http://localhost:5173`)*
3. **Buka Tab Browser yang Diperlukan**:
   - **Tab 1 (GitHub PR / Codebase)**: Pull Request `feat/monozukuri-interview-revamp-wismannur` atau file struktur proyek.
   - **Tab 2 (Alur Kandidat)**: Halaman invite kandidat, contoh: `http://localhost:5173/interview/<invite_token>`
   - **Tab 3 (Alur Asesor & Rekruter)**: Dashboard Asesor di `http://localhost:5173/assessments` dan Portfolio di `http://localhost:5173/sessions/<id>/portfolio`
   - **Tab 4 (Fit/Gap Report)**: `http://localhost:5173/sessions/<id>/fitgap` (menampilkan `SkillRadarChart`)
4. **Siapkan Split Terminal (atau tab terminal siap pakai)**:
   - Terminal 1: `cd api && bundle exec rspec` (siap dijalankan)
   - Terminal 2: `cd web && npm test` (siap dijalankan)
   - Terminal 3: Log Seeded Fault Test

---

## 2. Naskah Video Walkthrough Berwaktu (Timestamped Script)

### [00:00 - 00:40] Pembukaan & Visi Filosofi Monozukuri
- **Tampilan Layar**: Buka GitHub Pull Request `feat/monozukuri-interview-revamp-wismannur` atau file `FINAL_PRODUCT_ENGINEER_REPORT.md`.
- **Narasi Suara (Voiceover)**:
  > *"Halo tim penilai Rakamin, perkenalkan saya Wisman Nur. Hari ini saya mempresentasikan hasil audit teknis komprehensif, architectural hardening, dan release revamp dari AI Interview Platform.
  > Pendekatan yang saya terapkan berlandaskan filosofi **Monozukuri**—craftsmanship rekayasa tingkat senior staff yang melampaui sekadar checklist minimum: memastikan keandalan sistem berstandar industri, kepatuhan hukum privasi Indonesia melalui UU PDP No. 27/2022, ergonomi pengguna yang presisi, serta mitigasi kegagalan operasional di dunia nyata."*

---

### [00:40 - 01:30] Problem Discovery & Matriks Keparahan P0–P3
- **Tampilan Layar**: Sorot Severity Matrix di dokumen laporan atau file markdown.
- **Narasi Suara (Voiceover)**:
  > *"Dari audit mendalam, kami memetakan 4 celah P0 kritis serta isu operasional nyata:
  > 1. **P0-1 (Data Loss Trap)**: Regenerasi portfolio AI secara membabi buta menghapus kalibrasi nilai asesor manusia karena cascading deletion `dependent: :destroy`.
  > 2. **P0-2 (Invite URL Blocker)**: URL undangan sesi mengarahkan kandidat ke port API 3001, memicu 404 Routing Error.
  > 3. **P0-3 (LLM Parsing Fragility)**: Ketiadaan schema enforcement JSON pada Gemini HTTP client memicu crash pada background worker saat LLM merespons dengan markdown fence.
  > 4. **P0-4 & UU PDP**: Ketiadaan filter parameter menyebabkan data sensitif (PII) bocor ke log server, dan kandidat direkam tanpa persetujuan eksplisit.
  > Selain itu, kami mengidentifikasi bahaya operasional seperti layar perangkat yang mati saat interview panjang dan mic hardware lock saat berpindah antar halaman."*

---

### [01:30 - 02:40] Demonstrasi Alur Kandidat: UU PDP, Hardware Lifecycle & Live Interview
- **Tampilan Layar**: Buka tab browser kandidat (`http://localhost:5173/interview/:token`).
- **Aksi Klik**:
  1. Tunjukkan **PrivacyConsentModal**: Checkbox persetujuan wajib dicentang sebelum tombol "Lanjutkan ke Pengecekan Perangkat" aktif. Tunjukkan kutipan Pasal 20 UU PDP No. 27/2022.
  2. Masuk ke **HardwareCheck**: Lakukan mic check. Jelaskan bahwa saat tombol "Mulai Interview" ditekan, sistem secara deterministik memanggil `track.stop()` untuk membebaskan mikrofon dari browser lock.
  3. Masuk ke **InterviewPage**:
     - Tunjukkan visualizer **AiLiveOrb** yang responsif terhadap audio.
     - Tunjukkan indikator **Screen Wake Lock API**: Layar dijamin tidak akan sleep/mati otomatis selama sesi interview 30–45 menit, dan otomatis re-acquire jika kandidat sempat switch tab.
     - Tunjukkan **Auto-Scroll Transkrip**: Saat turn baru masuk, transkrip scroll otomatis, namun jika pengguna scroll ke atas untuk membaca jawaban sebelumnya, auto-scroll dijeda secara cerdas (sticky scroll protection).
- **Narasi Suara (Voiceover)**:
  > *"Mari kita lihat alur kandidat. Pertama, kandidat disambut oleh modal persetujuan dwibahasa berstandar UU PDP No. 27/2022. Tanpa persetujuan eksplisit, akses mikrofon tidak akan pernah dibuka.
  > Masuk ke Hardware Check, kami menyelesaikan bug hardware lock di mana track audio wajib di-stop secara bersih agar AudioWorklet di halaman interview tidak mengalami `NotReadableError`.
  > Di halaman interview aktif, kami mengintegrasikan AiLiveOrb visualizer, Screen Wake Lock API agar layar kandidat tidak sleep di tengah interview, serta transcript auto-scroll dengan deteksi posisi scroll pengguna."*

---

### [02:40 - 03:45] Demonstrasi Alur Asesor: Popover Override & Skill Radar Chart
- **Tampilan Layar**: Buka tab Asesor (Live Monitor, Portfolio, dan Fit/Gap Report).
- **Aksi Klik**:
  1. **Live Monitor**: Tunjukkan toggle `Recent (10 Turns)` vs `Full Transcript` tanpa memutuskan koneksi WebSocket.
  2. **Portfolio Page**: Klik tombol edit kalibrasi nilai pada salah satu skill.
     - Tunjukkan bahwa form kalibrasi muncul elegan di dalam **Popover (@radix-ui/react-popover)**, menjaga susunan grid kartu tetap rapi tanpa layout shift.
     - Ubah level nilai (misal dari L2 ke L4) dan berikan catatan asesor. Submit.
     - Jelaskan bahwa saat portfolio di-generate ulang oleh AI, nilai override manusia ini terlindungi 100% berkat transactional snapshotting.
  3. **Fit/Gap Report**: Tunjukkan komponen **SkillRadarChart** (spider chart multi-axis) yang membandingkan kompetensi kandidat vs benchmark vacancy secara visual, serta penanganan skill yang belum teruji dengan status `⚪ Not Assessed`.
- **Narasi Suara (Voiceover)**:
  > *"Bagi tim penilai dan rekruter:
  > Pada Live Monitor, asesor dapat berganti antara 10 giliran terakhir dan transkrip lengkap.
  > Pada Portfolio, kami merekayasa ulang panel kalibrasi asesor ke dalam Popover portal: membuka form tidak lagi merusak layout grid kartu kandidat. Nilai override manusia ini di-snapshot secara transaksional, sehingga kebal terhadap penghapusan berjenjang saat regenerasi AI dijalankan.
  > Pada Fit/Gap Report, asesor disajikan SkillRadarChart interaktif multi-axis untuk membaca kontur kompetensi kandidat terhadap target posisi dalam sekejap, lengkap dengan status 'Not Assessed' yang transparan."*

---

### [03:45 - 04:30] Proof of Rigor: Test Suite & Seeded Fault Mutation
- **Tampilan Layar**: Pindah ke layar terminal dan jalankan test suite live.
- **Aksi Terminal**:
  1. Jalankan `cd api && bundle exec rspec` -> Perlihatkan **27 examples, 0 failures**.
  2. Jalankan `cd web && npm test` -> Perlihatkan **24 tests passed across 9 suites**.
  3. Buka file atau log **Seeded Fault Test** di `assessment/03_verification_and_seeded_fault_test.md`.
- **Narasi Suara (Voiceover)**:
  > *"Bagi level Senior Staff, kualitas sistem dibuktikan dengan automated verification harness.
  > Di backend Rails, kami membangun 27 RSpec specs dengan 100% passing rate, mencakup transaksi database, isolasi multi-tenant, serta penanganan fallback WebSocket 1008/1006.
  > Di frontend React, kami membangun 24 Vitest specs di 9 berkas pengujian, memverifikasi UU PDP gating, lifecycle mikrofon, hingga auto-recovery Screen Wake Lock.
  > Lebih dari itu, kami membuktikan integritas harness ini melalui Seeded Fault Test: saat kami sengaja menyuntikkan bypass pada pemulihan override di `Portfolios::Generator`, test suite langsung merah (RED) pada baris 91, dan kembali hijau bersih (GREEN) saat dibatalkan."*

---

### [04:30 - 05:00] AI Verification Moments & Penutup
- **Tampilan Layar**: Tampilkan diagram perbandingan AI Hallucination vs Senior Staff Architectural Fix (atau halaman dokumen Section 04).
- **Narasi Suara (Voiceover)**:
  > *"Kami juga mendokumentasikan AI Verification Moments: bagaimana saran AI yang naif gagal memahami cascading delete ActiveRecord `dependent: :destroy` dan pelepasan otomatis Screen Wake Lock saat tab hidden. Di sinilah peran pengawasan kritis engineer senior menjadi benteng keandalan produk.
  > Seluruh kode, pengujian, laporan HTML interaktif, dan PDF report berstandar Monozukuri telah rapi ter-commit di branch `feat/monozukuri-interview-revamp-wismannur`.
  > Terima kasih atas perhatian tim Rakamin, dan saya siap untuk diskusi teknis mendalam."*

---

## 3. Panduan Tanya Jawab Teknis (Live Defense Preparation)

Berikut adalah skenario pertanyaan kritis yang berpotensi ditanyakan oleh Lead Reviewer Rakamin dan strategi jawaban terbaik:

### Q1: *"Mengapa memilih arsitektur decoupled (Opsi B) daripada direct streaming Gemini Live (Opsi A)?"*
- **Jawaban Senior Staff**:
  > *"Secara teori, direct audio streaming ke Gemini Live tampak menarik karena latensinya rendah (~500ms). Namun dalam realitas infrastruktur telekomunikasi Indonesia, koneksi seluler 4G kandidat memiliki latency jitter dan packet drop yang tinggi. Pada direct streaming, sekali koneksi terputus, seluruh context sesi hilang.
  > Dengan arsitektur Decoupled (Opsi B), audio diproses dalam chunk yang persisten di PostgreSQL per conversational turn. Jika kandidat terputus sinyal, mereka dapat melakukan reconnect tanpa kehilangan data wawancara sebelumnya. Selain itu, Opsi B menghemat biaya operasional hingga 90% ($0.25 vs $2.70 per sesi) dan menjamin rekaman transkrip tertulis verbatim yang menjadi kewajiban audit legal UU PDP No. 27/2022."*

### Q2: *"Bagaimana Anda memastikan kepatuhan UU PDP No. 27/2022 terimplementasi secara teknis, bukan sekadar teks di UI?"*
- **Jawaban Senior Staff**:
  > *"Kepatuhan UU PDP kami bangun dalam pertahanan dua lapis (defense-in-depth):
  > 1. **Di sisi Klien**: Kami menerapkan gating mutlak pada `PrivacyConsentModal`. Komponen browser MediaDevices dan audio recording sama sekali tidak diinisialisasi sebelum kandidat memberikan persetujuan eksplisit bertanda tangan digital (checkbox) sesuai Pasal 20 UU PDP.
  > 2. **Di sisi Server**: Kami mengonfigurasi `config/initializers/filter_parameter_logging.rb` untuk memfilter data sensitif (`invite_token`, `candidate_name`, `audio_chunk`, dan `transcript_text`). Data kandidat tidak akan pernah bocor ke file log server, APM, atau third-party log drainer sesuai Pasal 35 & 39 UU PDP."*

### Q3: *"Mengapa repot-repot mengimplementasikan Screen Wake Lock API dan pembersihan track audio secara manual?"*
- **Jawaban Senior Staff**:
  > *"Ini adalah pembeda antara kode prototipe lab dan aplikasi production-grade.
  > Wawancara teknis berlangsung 30–45 menit di mana kandidat lebih banyak berbicara tanpa menyentuh mouse atau keyboard. Layar OS secara default akan sleep/lock setelah 5 menit tidak ada input, yang langsung mematikan koneksi WebSocket audio. `useWakeLock` mencegah hal ini, dan secara cerdas mendengarkan event `visibilitychange` untuk me-reacquire lock jika kandidat sempat berpindah tab.
  > Sedangkan untuk pembersihan track audio, browser modern mengunci hardware mic. Jika `HardwareCheck` tidak memanggil `track.stop()`, inisialisasi AudioWorklet di halaman berikutnya akan melempar `NotReadableError`. Kami menyelesaikannya secara tuntas dan mengujinya dengan 3 automated test di Vitest."*

### Q4: *"Mengapa kalibrasi nilai asesor diubah menjadi Popover daripada inline accordion?"*
- **Jawaban Senior Staff**:
  > *"Pada dashboard portfolio, kartu kompetensi tersusun dalam sistem grid responsif. Membuka form accordion inline menyebabkan layout shift vertikal yang menggeser kartu di sebelahnya, mengganggu flow kognitif asesor yang sedang membandingkan beberapa skill.
  > Dengan `@radix-ui/react-popover`, form kalibrasi di-render di layer portal yang mengambang tepat di samping tombol pemicu, memiliki focus-trapping aksesibel, dan mempertahankan stabilitas visual grid 100%."*

### Q5: *"Bagaimana middleware menangani WebSocket close code 1008 dan prompt injection?"*
- **Jawaban Senior Staff**:
  > *"Pada `AudioWebsocketMiddleware`, kami menangani close code 1008 (Policy Violation) dan 1006 (Abnormal Closure) dengan mekanisme graceful fallback ke conversational state machine internal daripada memutus sesi kandidat. Di level prompt, kami menyematkan boundary delimiters dan instruksi sistem anti-jailbreak ketat agar AI tidak terbujuk oleh kandidat yang mencoba memanipulasi penilaian dengan teknik 'ignore previous instructions'."*
