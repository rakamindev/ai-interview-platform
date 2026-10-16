# Deep Context & Domain Immersion: AI Interview Platform

Dokumen ini disusun sebagai catatan analisis domain, konteks produk, kebutuhan pemangku kepentingan (*stakeholders*), analisis risiko, serta kepatuhan pelindungan data pribadi berdasarkan **Undang-Undang Republik Indonesia Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)**.

---

## 1. Lanskap Produk & Industri Rekrutmen Indonesia

### 1.1 Konteks Industri Rekrutmen di Indonesia
Industri ketenagakerjaan dan rekrutmen teknologi di Indonesia menghadapi tantangan struktural yang khas:
1. **Ketimpangan Rasio Pelamar vs Lowongan (*High-Volume Applicant Funnel*)**:
   - Untuk satu posisi *entry-level*, *internship*, maupun *associate software engineer*, perusahaan teknologi dan korporasi di Indonesia dapat menerima 500 hingga 3.000+ berkas lamaran.
   - *Resume screening* tradisional sarat akan bias kognitif (asal universitas ternama, format CV), sementara penugasan *take-home coding test* sering kali terkendala isu plagiarisme atau penggunaan AI generatif tanpa pemahaman konsep.
2. **Keterbatasan Kapasitas Assessor Teknis Senior**:
   - Melakukan wawancara teknis 45–60 menit oleh Senior Engineer/Lead menghabiskan puluhan *engineering hours* per minggu yang bernilai mahal (*context switching* dari *delivery* fitur produk).
3. **Kondisi Infrastruktur Digital Nasional**:
   - Kecepatan dan stabilitas internet bervariasi signifikan antar wilayah di Indonesia (kota metropolitan Tier-1 vs daerah Tier-2/Tier-3). Wawancara video dua arah (*full HD video conferencing*) sering kali mengalami *packet loss*, *jitter*, dan pemutusan sambungan.
   - Pilihan arsitektur platform ini yang berfokus pada **audio streaming (16kHz PCM)** dengan *Hardware Pre-check* terbukti sangat relevan dan inklusif bagi talenta di seluruh wilayah Indonesia.
4. **Dinamika Bahasa & Komunikasi (*Code-Switching*)**:
   - Percakapan teknis profesional di Indonesia lazim menggunakan kombinasi Bahasa Indonesia dan istilah teknis Bahasa Inggris (*code-switching*, misal: *"kemarin saya implement idempotency di endpoint PUT"*). AI assessor harus memiliki ketahanan linguistik yang kuat terhadap aksen lokal dan campur kode.

### 1.2 Posisi dan Nilai Tambah Platform
Platform ini memosisikan diri sebagai **evaluator kompetensi teknis berbasis percakapan alami terpandu (*autonomous conversational skills assessment*)**:
- Tidak menggunakan bank soal pilihan ganda statis, melainkan melakukan *probing* dinamis: AI mendengarkan jawaban kandidat, mengejar kedalaman teknis melalui pertanyaan lanjutan (*follow-up probe*), dan mengukur pemahaman nyata bukan hafalan.
- Mengoperasikan taksonomi kompetensi standar (**B7 Skill Taxonomy**) dengan skala kematangan bertingkat L1 (Foundational) hingga L5 (Expert).
- Menghubungkan hasil penilaian langsung ke spesifikasi jabatan (*Vacancy*) melalui **Fit/Gap Analysis Engine**, menghasilkan matriks kecocokan obyektif sebelum wawancara tatap muka final dilakukan.

---

## 2. Kebutuhan Pengguna (*User Personas & Needs*)

| Persona | Peran Utama | Kebutuhan Inti (*Jobs to be Done*) | Titik Kritis Keberhasilan |
|---|---|---|---|
| **Recruiter / Talent Acquisition** | Menyaring dan mengelola kandidat massal | • Pengiriman link tes asinkron tanpa koordinasi jadwal kalender.<br>• Pemantauan status sesi secara terpusat (*Awaiting*, *Live*, *Completed*).<br>• Ringkasan instan kandidat yang lolos passing grade. | • Integrasi lancar dengan ATS.<br>• Efisiensi *time-to-shortlist* dari hari menjadi hitungan jam. |
| **Assessor / Technical Interviewer** | Memvalidasi kompetensi teknis mendalam | • Transparansi data penilaian: tidak menerima penilaian AI sebagai *black box*.<br>• Ketersediaan *evidence quotes* (kutipan langsung kandidat) dan transkrip penuh.<br>• Kontrol intervensi manusia (*human override*) untuk mengoreksi bias model. | • Audit trail jelas jika rating AI diubah.<br>• Bukti konkret yang dapat dipertanggungjawabkan saat menolak/meloloskan. |
| **Hiring Manager / Tech Lead** | Mengambil keputusan akhir penerimaan | • Laporan ringkas kecocokan kandidat terhadap ekspektasi lowongan (*Fit/Gap report*).<br>• Visibilitas area kelebihan (*exceed*) dan kelemahan (*gap*) kandidat.<br>• Proyeksi *culture fit* dan kemandirian kerja. | • Ekspor dokumen eksekutif (PDF/JSON) yang siap dibahas dalam rapat panel rekrutmen. |
| **Kandidat (Candidate)** | Menjalani asesmen wawancara | • Petunjuk teknis dan hardware check yang jelas dan transparan.<br>• Pengalaman audio yang stabil tanpa *latency* mengganggu.<br>• Kesempatan adil untuk menunjukkan pemikiran sistematis tanpa diskriminasi. | • Kejelasan status hasil wawancara dan perlindungan kerahasiaan suara/jawaban. |

---

## 3. Jawaban atas 4 Pertanyaan Kritis

### Pertanyaan 1: Bagaimana platform membantu perusahaan menilai kandidat?
Platform mentransformasikan wawancara teknis dari proses manual yang lambat dan subjektif menjadi alur kerja yang terstandarisasi, terukur, dan terotomasi:
1. **Evaluasi Berbasis Bukti Nyata (*Evidence-Based Probing*)**:
   - AI tidak sekadar mencocokkan kata kunci (*keyword matching*). Menggunakan *system prompt compiler* yang diturunkan dari B7 Skill Taxonomy, AI mengeksplorasi pengalaman nyata kandidat melalui pertanyaan kontekstual (aturan: *"React to what they said, do not ask pre-planned scripts"*).
2. **Pelacakan Cakupan Kompetensi Real-Time (*Real-Time Coverage Tracking*)**:
   - Mesin *Coverage Analyzer* (N7) secara paralel mengamati giliran bicara (*turns*), memperbarui status tiap skill (`not_yet` -> `initiated` -> `partial` -> `covered`), dan memastikan AI tidak berpindah topik sebelum minimal 2 *probes* mendalam terpenuhi.
3. **Penyusunan Portfolio Multi-Dimensi (*Structured Skill Portfolio*)**:
   - Pasca sesi, model analitis (N10) membedah transkrip penuh, mengekstrak 2–3 kutipan perilaku kandidat paling representatif (*verbatim quotes*), menetapkan level kematangan L1–L5 yang terkalibrasi, serta menyertakan indikator tingkat keyakinan (*confidence score*: High/Medium/Low).
4. **Analisis Kesenjangan Kebutuhan (*Automated Fit/Gap Analysis*)**:
   - Membandingkan portofolio terukur kandidat terhadap matriks keterampilan lowongan (`Vacancy`). Sistem mengkategorisasikan tiap keahlian menjadi `Match`, `Gap`, `Exceed`, atau `Not Assessed`, dilengkapi narasi keselarasan budaya organisasi (*culture fit*).

### Pertanyaan 2: Bagian mana yang menyulitkan recruiter atau assessor?
Berdasarkan investigasi arsitektur dan penelusuran alur kerja, titik-titik friksi utama meliputi:
1. **Bagi Recruiter**:
   - **Ketiadaan Self-Serve User Management & Role Isolation**: Di endpoint login, otentikasi saat ini di-hardcode hanya meloloskan `user.role == 'admin'`. Recruiter non-admin tidak dapat login langsung tanpa bantuan tim IT/developer.
   - **Penanganan Sesi Gagal (*Failed Sessions Recovery*)**: Jika kandidat mengalami gangguan koneksi internet fatal atau error model di tengah jalan, recruiter tidak memiliki tombol cepat untuk *"Reset & Re-invite"* tanpa membuat sesi dari awal.
   - **Manajemen Batch/Mass Invitation**: Saat ini undangan kandidat dibuat satu per satu melalui modal dialog; belum ada fitur *import CSV* untuk mengundang puluhan kandidat sekaligus.
2. **Bagi Assessor Teknis**:
   - **Beban Verifikasi Halusinasi AI (*Verification Fatigue*)**: Assessor harus membaca ulang transkrip untuk memastikan apakah kutipan yang dijadikan dasar level L3/L4 benar-benar diucapkan oleh kandidat dan bukan fabrikasi model.
   - **Konflik Rating AI vs Penilaian Asesor**: Ketika assessor melakukan *Override*, assessor bertanggung jawab menuliskan justifikasi tertulis. Jika data *evidence* AI terlalu minim (*confidence: Low*), assessor merasa bekerja dua kali (mengulang wawancara manual).
   - **Live Monitor Concurrency**: Dalam kondisi banyak wawancara berjalan bersamaan, tidak ada fitur notifikasi atau dashboard multi-sesi untuk memantau sesi mana yang membutuhkan perhatian segera.

### Pertanyaan 3: Bagaimana kesalahan penilaian AI memengaruhi kandidat?
Kesalahan penilaian AI generatif (*algorithmic bias*, *hallucination*, atau *scoring inaccuracies*) memiliki implikasi serius terhadap kandidat:
1. **Penolakan Palsu (*False Rejection / Disparate Impact*)**:
   - Jika kandidat memiliki gaya komunikasi non-standar, artikulasi terbata-bata karena kegugupan, atau menggunakan aksen daerah, AI LLM berisiko salah menginterpretasikan hal tersebut sebagai *"kurang kompeten"* (diberi L1/L2 meskipun logika arsitekturnya benar).
   - Akibatnya, talenta berpotensi gugur pada tahap awal tanpa pernah mendapat kesempatan bertatap muka dengan evaluator manusia.
2. **Penilaian Palsu Keatas (*False Acceptance / Incompetence Slip*)**:
   - Kandidat yang fasih menggunakan jargon teknologi (*buzzwords*) namun tidak memiliki kedalaman implementasi dapat memperoleh rating L4/L5 jika AI tidak cukup agresif melakukan *stress-testing*. Hal ini merugikan perusahaan dan menempatkan kandidat pada ekspektasi kerja yang tidak realistis.
3. **Ketidakadilan Tanpa Hak Koreksi (*Lack of Recourse*)**:
   - Jika sistem bersifat tertutup (*black-box*), kandidat tidak memahami mengapa mereka ditolak. Kandidat kehilangan hak atas evaluasi yang transparan (*adverse action explanation*).
4. **Kecemasan dan Resistensi Psikologis (*Candidate Stress & Anxiety*)**:
   - Berbicara dengan bot AI tanpa ekspresi visual manusia dapat meningkatkan stres kognitif kandidat, memicu performa di bawah standar yang tidak mencerminkan kemampuan kerja harian mereka yang sesungguhnya.

### Pertanyaan 4: Data pribadi apa yang diproses dan bagaimana melindunginya berdasarkan UU PDP (UU No. 27 Tahun 2022)?

#### A. Klasifikasi Data Pribadi yang Diproses
Sesuai **Pasal 4 UU PDP**, platform ini mengumpulkan dan memproses dua kategori data pribadi:
1. **Data Pribadi yang Bersifat Umum (Pasal 4 Ayat 3)**:
   - Nama lengkap kandidat (`candidate_name`).
   - Alamat email dan identitas akun (`users.email`).
   - Riwayat pekerjaan, kualifikasi profesional, dan profil kompetensi teknis (`portfolios`, `portfolio_skills`, `vacancies`).
2. **Data Pribadi yang Bersifat Spesifik / Sensitif (Pasal 4 Ayat 2)**:
   - **Data Biometrik Suara (*Voice Audio Data*)**: Aliran audio mentah 16kHz PCM yang dapat mengidentifikasi karakteristik fisik/akustik unik individu.
   - **Transkrip Suara-ke-Teks (*Verbatim Transcript Turns*)**: Catatan percakapan kata demi kata yang berpotensi memuat opini pribadi, riwayat kompensasi masa lalu, atau informasi konfidensial tempat kerja sebelumnya yang tidak sengaja terucap oleh kandidat.
   - **Data Telemetri Perangkat & Jaringan**: IP address, informasi sistem operasi, peramban, dan latensi jaringan (*network telemetry*).

#### B. Kewajiban & Prinsip Pelindungan Berdasarkan UU PDP
Sebagai **Pengendali Data Pribadi (*Data Controller*)**, perusahaan dan pengembang platform wajib menerapkan prinsip-prinsip berikut:

1. **Persetujuan yang Sah & Eksplisit (*Explicit Consent* - Pasal 20 & 22 UU PDP)**:
   - Sebelum mengakses mikrofon dan memulai wawancara, kandidat wajib diberikan lembar persetujuan (*Informed Consent Sheet*) yang menjelaskan secara eksplisit:
     - Tujuan pemrosesan suara dan transkrip.
     - Bahwa evaluasi dibantu oleh pemrosesan kecerdasan artifisial (AI).
     - Durasi penyimpanan data rekaman audio dan transkrip.
2. **Pembatasan Tujuan (*Purpose Limitation* - Pasal 16 Ayat 2 UU PDP)**:
   - Rekaman suara dan transkrip hanya boleh digunakan untuk kepentingan penilaian rekrutmen posisi yang dilamar, dan **dilarang keras** digunakan untuk melatih model AI publik (*training data*) pihak ketiga tanpa persetujuan khusus.
3. **Keamanan Pemrosesan & Enkripsi (*Data Security* - Pasal 35 & 39 UU PDP)**:
   - **Data in Transit**: Wajib menggunakan enkripsi TLS 1.3/WSS untuk semua transmisi WebSocket dan HTTPS REST API.
   - **Data at Rest**: Data transkrip, rekaman audio, dan kredensial JWT wajib dienkripsi di tingkat database (*PostgreSQL pgcrypto / column-level encryption*).
   - **Multi-Tenant Isolation**: Menjamin isolasi data ketat antar organisasi (`TenantScoped`), memastikan tenant A tidak dapat melihat portfolio kandidat tenant B.
4. **Hak Subjek Data Pribadi (Pasal 5 s.d. Pasal 13 UU PDP)**:
   - **Hak Akses & Transparansi (Pasal 5)**: Kandidat berhak mengetahui data apa saja yang dicatat dan penilaian yang dihasilkan.
   - **Hak Perbaikan/Koreksi (Pasal 6)**: Jika terjadi kesalahan pencatatan nama atau transkrip yang melenceng, harus ada mekanisme koreksi.
   - **Hak Menolak Penilaian Otomatis Penuh (*Automated Decision Making Recourse* - Pasal 10)**:
     - *"Subjek Data Pribadi berhak untuk menolak keputusan yang hanya didasarkan pada pemrosesan secara otomatis, termasuk pemrofilan (*profiling*), yang menimbulkan akibat hukum atau berdampak signifikan."*
     - **Implementasi pada platform**: Fitur **Assessor Override** menjadi instrumen wajib (*mandatory human-in-the-loop*). Keputusan akhir penerimaan atau penolakan **tidak boleh diambil 100% oleh AI**, melainkan harus disahkan oleh asesor/recruiter manusia.
5. **Retensi & Penghapusan Data (*Data Retention & Erasure* - Pasal 43 & 44 UU PDP)**:
   - Data rekaman audio mentah harus memiliki batas waktu simpan (*retention policy*, misal: maksimal 30 hari pasca rekrutmen selesai), dan setelah itu dihapus secara permanen (*purged*), menyisakan transkrip teranonimisasi jika diperlukan untuk arsip kepatuhan.

---

## 4. Matriks Risiko Produk & Rekomendasi Hardening

| Area Risiko | Skenario Kegagalan | Dampak Bisnis / Hukum | Rekomendasi Mitigasi Teknis |
|---|---|---|---|
| **Platform Crash (EventMachine/Puma)** | Kegagalan WSS SSL di Windows atau crash mode worker | Wawancara kandidat terputus mendadak (*disconnection during live session*) | Standarisasi deployment berbasis Linux Docker container; implementasi circuit-breaker dan fallback gracefully pada WebSocket client. |
| **Prawn PDF Unicode Incompatibility** | Unhandled exception akibat encoding karakter Windows-1252 | Assessor gagal mengunduh hasil portfolio resmi untuk rapat hiring manager | Ganti font standar AFM dengan font TTF bersertifikasi UTF-8 (misal: Noto Sans / Roboto) dan sanitasi karakter teks menyeluruh. |
| **Ketiadaan Human-in-the-Loop Audit** | Asesor meloloskan/menolak kandidat tanpa memeriksa bukti | Pelanggaran Pasal 10 UU PDP (keputusan otomatis sepihak) dan risiko salah rekrut | Wajibkan konfirmasi/tinjauan manual asesor sebelum status kelulusan kandidat diumumkan ke publik. |
| **Kebocoran Data Antar Tenant** | Kebocoran token JWT atau endpoint tanpa filter `tenant_id` | Pelanggaran kerahasiaan data (denda administratif UU PDP s.d. 2% pendapatan tahunan) | Audit konsistensi `TenantScoped` di semua query ActiveRecord; rotasi `SECRET_KEY_BASE` berkala; pengujian multi-tenant penetration testing. |

---

## 5. Kesimpulan Domain Immersion
Platform AI Interview ini menyelesaikan masalah efisiensi penyaringan talenta teknologi secara nyata di Indonesia melalui pendekatan audio interaktif dan taksonomi terstandarisasi. Namun, keandalan teknis dan akuntabilitas etis harus menjadi fondasi utama:
1. AI berfungsi sebagai **kopilot penilai (*augmenting evaluator*)**, bukan penentu nasib akhir kandidat.
2. Transparansi bukti (*evidence quotes*) dan kontrol manusia (*override*) adalah prasyarat kepatuhan terhadap regulasi UU PDP.
3. Robustness arsitektur backend terhadap variasi jaringan dan stabilitas platform merupakan kunci kenyamanan pengalaman kandidat.
