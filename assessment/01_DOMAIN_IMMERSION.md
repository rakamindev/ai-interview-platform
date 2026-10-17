# Step 2: Deep Context & Domain Immersion

## 1. The Product
AI Interview Platform adalah platform asesmen talenta teknis berbasis suara (*real-time live audio assessment*) yang mengintegrasikan model multimodal Google Gemini (Gemini Live WebSocket untuk percakapan lisan 16kHz/24kHz, Gemini Flash untuk pelacakan kompetensi adaptif real-time, dan Gemini Pro untuk sintesis portofolio keterampilan pasca-sesi).

Platform ini dirancang bukan sekadar sebagai formulir tanya-jawab otomatis, melainkan mengemulasikan perilaku pewawancara teknis manusia senior:
- Tidak membacakan daftar pertanyaan statis.
- Mendengarkan dan memverifikasi klaim spesifik yang dibuat oleh kandidat (*deep probing*).
- Menantang secara proporsional sesuai kekuatan jawaban (jawaban umum ditantang contoh konkret, jawaban kuat diuji skenario batas dan skalabilitas 10x).
- Menelusuri kompetensi tak terduga (*discovered skills*) yang relevan namun di luar agenda awal.
- Menjaga transisi percakapan tetap natural tanpa pengumuman kaku.

---

## 2. The Industry: Hiring & Talent Assessment in Indonesia
Pasar rekrutmen talenta teknologi di Indonesia menghadapi ketimpangan struktural:
1. **Asimetri Informasi & Inflasi CV**: Volume pelamar untuk posisi junior hingga senior sangat besar (ratusan hingga ribuan pelamar per lowongan), diperparah maraknya *resume buzzwords* dan template CV AI generatif yang menyamarkan kemampuan teknis riil.
2. **Kelelahan Rekruter & Keterbatasan Engineering Hours**: Melibatkan software engineer senior atau tech lead untuk wawancara teknis tahap awal memakan puluhan jam kerja per sprint, menurunkan produktivitas *core engineering*.
3. **Komoditisasi vs Real Leverage**:
   - *Komoditas*: Platform kuis pilihan ganda, leetcode coding puzzle, atau bot wawancara teks asinkron yang mudah diakali (bisa dibuka dengan tab browser lain atau disontek).
   - *Real Leverage*: Wawancara dialog lisan interaktif dan dinamis yang menuntut kandidat mempertahankan keputusan arsitektur, mendiskusikan *trade-offs*, dan menjelaskan *root cause analysis* secara spontan. Di sinilah sinyal kompetensi murni terlihat.

---

## 3. What It Is For: Outcome & Viability
Platform ini ada untuk menghasilkan **keputusan hiring yang objektif, transparan, dan defensif**:
- **Anchor Berbasis Bukti**: Menilai kandidat berdasarkan skala L1 hingga L5 dengan jangkar perilaku (*behavioral anchors*) yang konkret dan dapat diverifikasi, bukan opini subyektif "feeling" pewawancara.
- **Kutipan Bukti Verifikatif (*Evidence Quotes*)**: Setiap penilaian level kompetensi wajib didukung 2–3 kutipan transkrip asli dari kandidat yang menunjukkan *bagaimana* mereka berpikir dan bertindak.
- **Fit/Gap Deterministik**: Membandingkan profil kandidat terhadap standar kebutuhan lowongan (*vacancy*) secara transparan, memberikan sinyal celah (*gap*), kecocokan (*match*), atau keunggulan (*exceed*).

---

## 4. The Users: Assessors, Recruiters, & Hiring Managers
- **Hari Kerja & Beban**: Rekruter mengelola banyak lowongan secara paralel dengan waktu terbatas. Mereka membutuhkan ringkasan eksekutif instan namun mendalam untuk meloloskan kandidat ke *on-site technical defense*.
- **Kebutuhan Esensial**:
  - Live Monitor: Mengetahui status wawancara saat berlangsung tanpa harus menginterupsi.
  - Audit Trail & Override: Kemampuan mengoreksi (*override*) level kompetensi yang diberikan AI jika terdapat konteks organisasi tertentu, dilengkapi catatan asesmen (*assessor notes*).
  - Ekspor Resmi: Laporan PDF/JSON berkualitas tinggi yang siap dipresentasikan kepada CTO atau VP Engineering.

---

## 5. The People Affected Who Never Chose It: Kandidat & Kepatuhan UU PDP
Kandidat adalah pihak yang paling rentan dalam sistem ini. Mereka tidak memilih untuk dinilai oleh AI, tidak memiliki kekuatan tawar untuk menolak, dan hasil evaluasi yang salah (*false negative*) dapat mengubah lintasan karier mereka.

### Kepatuhan UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP):
1. **Prinsip Minimasi Data & Tujuan Spesifik (Pasal 16)**:
   - Data suara dan transkrip hanya diproses semata-mata untuk tujuan penilaian kualifikasi pekerjaan terkait.
   - Sistem tidak boleh mengumpulkan atau menyimpan data biometrik identitas di luar audio kerja wawancara.
2. **Kerahasiaan & Keamanan Data Pemrosesan (Pasal 35 - 39)**:
   - Log aplikasi di backend dilarang keras mencatat rekaman suara mentah, transkrip lengkap yang berisi informasi sensitif, token otorisasi JWT, atau PII kandidat.
   - Pengiriman data audio dan teks melalui WebSocket serta REST API wajib terenkripsi (WSS/HTTPS).
3. **Hak Subjek Data Pribadi (Pasal 5 - 13)**:
   - Kandidat berhak mendapatkan kejelasan instruksi teknis sebelum wawancara dimulai (uji perangkat mic/speaker).
   - Penanganan kegagalan teknis (koneksi terputus / *packet loss*) harus memiliki masa tenggang toleransi (*grace period*) yang memadai, sehingga gangguan jaringan di Indonesia (yang sering mengalami latensi fluktuatif) tidak langsung menggugurkan kandidat secara sepihak.
