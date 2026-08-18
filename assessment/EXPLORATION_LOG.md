# Exploration Log — AI Interview Platform Candidate Journey

Living log untuk PRODUCT EXPLORATION / USER JOURNEY TESTING, sebelum scope decision (§4.1).
Ini working log (dicatat saat kejadian), bukan laporan final — dirapikan ke PDF nanti.

Legend status: 🟢 PASS · 🟡 PARTIAL · 🔴 FAIL · ⚠️ BLOCKER/PERLU KLARIFIKASI · ⚪ NOT TESTED

---

## Peta Journey Candidate

```
ASSESSOR
   │
   ▼
ASSESSMENT
   │
   ▼
INVITE
   │
   ▼
CANDIDATE
   │
   ▼
HARDWARE CHECK     🟢 PASS — Internet false-negative ditemukan + di-fix + re-verified.
   │                          Mic/audio terkonfirmasi jalan (interview sungguhan sukses).
   ▼
AI INTERVIEW        🟢 PASS — selesai natural, diakhiri oleh AI-nya sendiri, tidak ada
   │                          masalah dilaporkan candidate. Lihat STEP 02.
   ▼
EVIDENCE              🟢 PASS — transcript tersimpan & terbaca lengkap (verified,
   │                          "Interview Transcript" page). Independen dari Portfolio.
   ▼
COVERAGE               🟡 PARTIAL — `[N7]` gagal SAAT interview session 2 berlangsung
   │                          (key lama). B-02 di-fix sesudahnya; belum ada interview BARU
   │                          untuk buktikan Coverage real-time jalan dengan key baru.
   ▼
LIVE MONITOR             ⚪ NOT TESTED langsung (UI belum dibuka) — sama alasannya,
   │                          perlu interview baru untuk ngetes real-time.
   ▼
PORTFOLIO                  🟢 PASS (setelah fix B-02) — di-retry dari UI assessor,
   │                          `[N10] Portfolio generated for session 2`, isi lengkap & masuk akal.
   ▼
CONFIDENCE                   🟡 terlihat di Portfolio Results (badge "Confidence: LOW"
   │                          pada discovered skill) — belum ditelusuri sebagai halaman sendiri.
   ▼
FIT / GAP                      🟢 PASS — dibuat 1 vacancy test ("Flutter Engineer"),
   │                          Run Fit/Gap Analysis sukses: skill comparison, match/gap,
   │                          culture fit narrative, discovered-skills section. Lihat STEP 04.
   ▼
HIRING DECISION                   ⚪ NOT TESTED
```

---

## Bug / Problem Tracking

| ID | Bug | Page | User | Blocker? | Root Cause | Fix Now? | Candidate Scope? |
|----|-----|------|------|----------|------------|----------|------------------|
| B-01 | Internet speed check false negative — upload terukur 1.69 Mbps padahal koneksi asli baik | Hardware Check (`/interview/:token`) | Candidate | ✅ Ya — "Start Interview" terkunci permanen, upload measurement konsisten underreport tiap retry | `measureUploadSpeed()` di [internetSpeedTest.ts](../web/src/utils/internetSpeedTest.ts) men-timing `fetch()` yang mencakup waktu proses "echo" server pihak ketiga gratisan (httpbin.org/postman-echo.com) — bukan murni waktu transfer. `VITE_SPEED_TEST_UPLOAD_URL` kosong, tidak ada endpoint sendiri. | ✅ Sudah — commit `8cc6792`, timing dipindah ke event `xhr.upload` (murni waktu kirim, exclude DNS/TLS + waktu proses server asing) | ❌ Bukan case-study scope — exploration blocker, minimal fix, jangan dikembangkan jadi speed-test feature |
| B-02 | Coverage analysis (N7), Portfolio generation (N10), dan Fit/Gap engine **semua gagal** dengan `Gemini::HttpClient API error 400: API_KEY_INVALID` — sementara AI Interview (Gemini Live via WebSocket) jalan normal pakai `GEMINI_API_KEY` yang **sama persis** | Assessor → Portfolio Results (`Budi` / Flutter Engineer) | Assessor (dan tidak langsung: candidate, karena Coverage juga kena) | ⚠️ Ya — untuk lanjut explore COVERAGE/LIVE MONITOR/PORTFOLIO/CONFIDENCE/FIT-GAP. Tidak blocking AI INTERVIEW/EVIDENCE (jalur terpisah). | **Dikonfirmasi:** key lama di `application.yml` adalah API key Google Cloud yang **bound ke service account** (dibuat dari Cloud Console → Credentials) — tipe key untuk akses gaya Vertex AI/Agent Platform, bukan untuk endpoint REST klasik `generativelanguage.googleapis.com/v1` yang dipakai `Gemini::HttpClient` (`api/app/clients/gemini/http_client.rb:5`) dengan header `x-goog-api-key` (pola key AI Studio biasa). Live API (WebSocket, `live_client.rb`) ternyata menerima key service-account-bound ini, REST v1 tidak. | ✅ **Sudah** — user generate key baru langsung dari aistudio.google.com/apikey (key gaya AI Studio biasa, project sama), saya update `api/config/application.yml`, restart Puma+Sidekiq, retry Portfolio dari UI assessor → `[N10] Portfolio generated for session 2` (sukses, isi lengkap: skill ratings, evidence quotes, discovered skills, Fit/Gap section aktif). Key lama/baru tidak pernah masuk git (file gitignored). | ✅ Ini murni infra/config (jenis API key salah), bukan product bug — tidak masuk case-study scope. Catatan failure-UX ("Retry generik tanpa hint kenapa/harus ngapain") masih berlaku sebagai observasi terpisah kalau mau dipakai. |

| B-03 | Dropdown "Choose vacancy..." di Portfolio Results tampil kosong tanpa penjelasan saat belum ada vacancy — beda dengan halaman `/vacancies` yang sudah benar kasih empty state + CTA "Create your first vacancy" | Portfolio Results (Fit/Gap section) | Assessor | ❌ Tidak — cuma perlu tau "pergi buat vacancy dulu di menu Vacancies", tidak menghalangi journey setelah tau caranya | Dropdown vacancy di halaman ini tidak menangani kasus list kosong dengan pesan/CTA, beda dari halaman Vacancies yang sudah punya empty state layak | ✅ Sudah — [PortfolioPage.tsx:234-260](../web/src/pages/portfolio/PortfolioPage.tsx#L234), empty-state (ikon + pesan + tombol "Create your first vacancy" → `/vacancies/new`) menggantikan dropdown kosong. Verified di browser (lihat detail di STEP 04). | ✅ Product initiative yang diminta secara eksplisit — dianggap perbaikan nyata, bukan cuma exploration housekeeping |

*(Bug non-blocker lain akan ditambahkan ke tabel ini sambil jalan.)*

---

## Step Log

# STEP 01

**ROLE:** Candidate

**PAGE:** `http://localhost:5173/interview/c32e59791b6353d2a66131bb3f74134f9b38636aed10cafc13edba801a28c256` — Hardware Check (pre-interview)

**USER ACTION:** Membuka link undangan interview. Hardware check jalan otomatis: OS & browser → Internet → Microphone → Audio output.

**EXPECTED:** Keempat check lulus (asumsi hardware/koneksi wajar), tombol "Start Interview" aktif.

**ACTUAL:**
- OS & browser: 🟢 PASS
- Internet (percobaan pertama): 🔴 FAIL — ↓48.48 Mbps ✅ / ↑1.69 Mbps ❌ (syarat ≥4 Mbps) / 44ms ✅. Satu metrik gagal → seluruh baris "Internet" gagal → tombol "Start Interview" terkunci.
- Setelah minimal fix (B-01), re-test: ↓37.12 Mbps / ↑5.83 Mbps / 52ms → 🟢 PASS.
- Microphone/Audio output: ⚪ belum bisa saya verifikasi — browser otomatis yang saya pakai diblokir akses mic sungguhan oleh sistem. Ini keterbatasan tooling saya, **bukan temuan produk** — perlu kamu konfirmasi manual di browser asli.

**STATUS:** ⚠️ BLOCKER → 🟢 PASS (Internet, setelah fix). Microphone/Audio: ⚪ NOT TESTED oleh saya.

---

**TRACE**
```
USER
 ↓ (buka link interview)
FRONTEND (HardwareCheck.tsx → testInternetSpeed())
 ↓ (100% jalan di browser)
[TIDAK melalui API/backend kita]
 ↓
PIHAK KETIGA: httpbin.org / postman-echo.com (endpoint publik gratisan)
 ↓
RESULT (Mbps dihitung dari waktu respons)
 ↓
UI (baris "Internet" render Passed/Failed)
```
Catatan: check ini murni client-side, tidak menyentuh Rails API/database/Redis/Sidekiq kita.
Itu justru bagian dari akar masalah — yang terukur bukan koneksi ke server kita, tapi koneksi
ke server gratisan pihak ketiga yang performanya sendiri tidak terjamin.

**USER POV**
Sebagai candidate: baris "Internet" merah "Failed", tapi angka di sampingnya (48 Mbps download)
kelihatan bagus — bingung kenapa dibilang gagal. Tidak ada penjelasan di UI kenapa spesifik
upload yang bermasalah. Satu-satunya aksi yang kelihatan cuma tombol "Retry", yang kemungkinan
besar gagal lagi karena akar masalahnya bukan di koneksi candidate. Risiko nyata: candidate
panik/menyerah/hubungi HR sebelum sempat mulai interview sama sekali.

**TECHNICAL POV**
Tidak ada Redis/Sidekiq/WebSocket di step ini. Browser mengirim file kecil percobaan ke layanan
gratisan di internet, lalu mengukur berapa lama sampai selesai, dan itu dianggap "kecepatan
upload kamu". Masalahnya, layanan gratisan itu juga butuh waktu memproses & membalas — waktu
proses mereka ikut kehitung sebagai "kecepatan internetmu", padahal itu waktu server mereka yang
lambat/sibuk. Fix: ukur hanya waktu browser selesai *mengirim* datanya (event `xhr.upload`
bawaan browser), bukan tunggu server asing itu selesai membalas.

**KONSEKUENSI**

NORMAL:
```
USER → Buka link interview → Hardware check (4 item) → ✅ SUCCESS (semua lulus)
     → Tombol "Start Interview" aktif → lanjut ke AI Interview
```

FAILURE (sebelum fix):
```
USER → Buka link interview → Hardware check jalan → ❌ Internet gagal (false negative,
     konsisten gagal tiap retry) → Tombol "Start Interview" TERKUNCI PERMANEN
     → Candidate stuck, tidak pernah bisa mulai interview, tidak tahu ini bug
     pengukuran — bukan koneksi mereka
```

**VERIFICATION**
- Sebelum fix: ↓48.48 / ↑1.69 (fail) / 44ms — dari screenshot yang kamu kirim.
- Sesudah fix (commit `8cc6792`), dites via automated browser: ↓37.12 Mbps / ↑5.83 Mbps / 52ms → Passed.
- Screenshot "Internet: Passed" sudah dilihat langsung dalam sesi ini, belum disimpan sebagai file
  — kalau perlu untuk laporan PDF, ambil ulang di browser asli kamu (sekalian dapat state
  mic/audio yang sungguhan, yang tidak bisa saya verifikasi).

---

# STEP 02

**ROLE:** Candidate

**PAGE:** Token yang sama — layar **"Interview Complete"** setelah AI Interview selesai.

**USER ACTION:** Menjalankan interview secara manual di browser asli (paralel dengan saya
mengerjakan git commit sebelumnya) — role "Flutter Engineer", sebagai candidate "Budi".

**EXPECTED:** Interview berjalan, AI mengajukan pertanyaan relevan ke skill yang dinilai,
selesai dengan wajar, redirect ke halaman "Interview Complete".

**ACTUAL:** Dikonfirmasi user: **tidak ada masalah**. Interview selesai natural — diakhiri
oleh AI-nya sendiri (bukan timeout, bukan candidate klik "selesai" manual, bukan error).
`GET /api/v1/sessions/:token/candidate` mengembalikan
`{"session_id":2,"role_title":"Flutter Engineer","time_limit_min":45,"session_status":"ended"}`
— konsisten dengan laporan user.

**STATUS:** 🟢 PASS

---

**TRACE**
```
USER (candidate, browser asli)
 ↓ (klik "Start Interview", bicara via mic)
FRONTEND (halaman interview, kirim/terima audio)
 ↓ WebSocket
BACKEND (Gemini::LiveClient, api/app/clients/gemini/live_client.rb)
 ↓ WebSocket ke Google
GEMINI LIVE API (percakapan suara real-time, model dari GEMINI_LIVE_MODEL)
 ↓
AI memutuskan interview selesai → session_status: "ended"
 ↓
UI → "Interview Complete"
```
Catatan: saya tidak punya akses ke console/network log dari browser asli kamu saat interview
berlangsung — trace di atas dari baca kode + konfirmasi kamu, bukan observasi langsung saya.
Kalau ada momen aneh (delay, re-connect) yang belum kesebut, tambahkan manual ke sini.

---

# STEP 03

**ROLE:** Assessor

**PAGE:** Login (`/login`) → Assessments → "Flutter Engineer" → candidate "Budi" → **Results**
(login pakai kredensial seed dari `ROADMAP.md`: `assessor@test-corp.local`)

**USER ACTION:** Assessor login, buka assessment "Flutter Engineer" (1 candidate: Budi,
status "Completed"), klik "Results" untuk lihat Portfolio.

**EXPECTED:** Halaman Portfolio Results menampilkan ringkasan skill candidate (portfolio
narrative yang di-generate AI dari transcript + coverage).

**ACTUAL:**
- Portfolio Results: 🔴 kotak merah **"Portfolio generation failed."** + tombol "Retry"
  (screenshot diambil, lihat chat). Retry akan gagal lagi — sudah dicoba 3x manual oleh user
  sebelum ini (`POST /sessions/2/portfolio/regenerate` di log, 03:54/03:55/03:58) dan gagal
  identik tiap kali.
- Tombol "Transcript" di halaman yang sama: 🟢 dicoba, isinya lengkap & masuk akal — tanya
  jawab AI Interviewer ↔ Candidate soal state management strategy, dst. **Evidence capture
  tidak terpengaruh** oleh gagalnya Portfolio generation — jalur data terpisah.
- Log backend (`api/log/development.log`) konfirmasi root cause: `[N7] Coverage analyzer
  failed for session 2` dan `[N10] Portfolio generation failed/permanently failed for
  session 2`, keduanya `Gemini::HttpClient::ApiError API returned 400` — body error dari
  Google: `API key not valid. Please pass a valid API key.` (`reason: API_KEY_INVALID`).
- `fit_gap/engine.rb` dikonfirmasi (baca kode) pakai client yang sama → resiko gagal identik,
  belum dites langsung di UI.

**STATUS:** 🔴 FAIL awal (Portfolio/Coverage/kemungkinan Fit-Gap) → 🟢 **RESOLVED** (lihat
update di bawah). 🟢 PASS dari awal untuk Evidence/Transcript di halaman yang sama.

---

**TRACE**
```
ASSESSOR
 ↓ (klik "Results" untuk candidate yang sudah selesai)
FRONTEND (PortfolioResults page)
 ↓ GET /api/v1/sessions/2/portfolio
BACKEND (PortfoliosController)
 ↓ baca kolom tersimpan
DATABASE (portfolios.generation_status = 'failed',
          portfolios.generation_error = "Failed after 3 retries: API returned 400")
 ↓
UI → render kotak error + Retry

(Sebelumnya, saat generation coba jalan via Sidekiq worker:)
SIDEKIQ WORKER (PortfolioGeneratorWorker / CoverageAnalyzerWorker)
 ↓ panggil
Gemini::HttpClient (REST v1, hardcoded)
 ↓
GOOGLE GEMINI API → 400 API_KEY_INVALID
 ↓
worker retry 3x → permanently failed → simpan generation_error ke DB
```
Menarik: **AI Interview pakai `GEMINI_API_KEY` yang sama tapi lewat WebSocket (Live API) dan
itu jalan normal.** Jadi bukan berarti key-nya "kosong" — kemungkinan besar key ini di Google
AI Studio/Cloud Console cuma di-enable/scope untuk Live API, belum untuk REST `generateContent`
v1 biasa yang dipakai Coverage/Portfolio/Fit-Gap. Ini dugaan terbaik saya dari bukti yang ada,
bukan kepastian — perlu dicek langsung di console Google kamu.

**USER POV**
Sebagai assessor: interview candidate selesai, statusnya "Completed" — kelihatan berhasil.
Tapi begitu buka Results, cuma ada kotak merah "Portfolio generation failed" + tombol Retry.
Tidak ada info kenapa gagal, tidak ada indikasi ini masalah konfigurasi vs masalah sementara.
Retry kemungkinan besar akan dicoba berkali-kali (persis yang tadi terjadi — 3x manual) tanpa
hasil beda, karena akar masalahnya bukan sesuatu yang "coba lagi" bisa selesaikan. Assessor
tidak dapat cara untuk tahu ini harus dieskalasi ke siapa atau apa yang salah.

**TECHNICAL POV**
Ada 3 "pekerja" (worker) di background yang jalan setelah interview selesai — dianggap seperti
petugas yang mengambil tugas dari antrean (ini yang disebut Sidekiq + Redis: Redis itu tempat
antrean tugasnya, Sidekiq itu petugas yang ambil & kerjakan satu-satu, di luar proses candidate
menjawab pertanyaan). Salah satu tugasnya: "bikin ringkasan portfolio dari jawaban candidate,
pakai AI". Tugas itu gagal karena AI-nya (Google Gemini) menolak kunci akses yang dipakai —
tapi hanya untuk JALUR TEKS biasa; jalur SUARA real-time (yang dipakai pas interview
berlangsung) menerima kunci yang sama. Jadi ada 2 "pintu" berbeda ke Google Gemini, dan kunci
akses kita ternyata cuma dibukakan untuk satu pintu.

**KONSEKUENSI**

NORMAL:
```
INTERVIEW SELESAI → Worker generate Coverage + Portfolio + Fit/Gap (background)
 ↓
✅ SUCCESS
 ↓
Assessor buka Results → lihat ringkasan skill, evidence, rekomendasi
```

FAILURE (kondisi sekarang):
```
INTERVIEW SELESAI → Worker coba generate Coverage + Portfolio + Fit/Gap
 ↓
❌ Gemini API menolak key (khusus jalur REST) → retry 3x → permanently failed
 ↓
Assessor buka Results → kotak merah generik + tombol Retry yang akan gagal lagi
 ↓
Transcript/Evidence TETAP bisa dibuka (jalur terpisah, tidak kena dampak)
```

**VERIFICATION**
- Screenshot "Portfolio generation failed." — dilihat langsung dalam sesi ini.
- Screenshot "Interview Transcript" (isi lengkap, bukan kosong) — dilihat langsung.
- Log backend dicek langsung (`api/log/development.log`, baris ber-tag `[N7]`/`[N10]`,
  72 kemunculan total error `API key not valid` sepanjang sesi explorasi ini).
- **Belum diverifikasi**: Live Monitor (coverage progress bar real-time), Confidence
  indicator sebagai halaman sendiri, Fit/Gap page — diduga kuat kena dampak sama (baca
  STEP selanjutnya).

---

**UPDATE — RESOLVED (B-02):**

User cek langsung ke Google Cloud Console, screenshot key yang error: ternyata key lama
adalah **API key yang bound ke service account** (dibuat dari Cloud Console → Credentials,
bukan dari AI Studio langsung) — tipe key untuk Vertex AI/Agent Platform, bukan cocok untuk
endpoint REST `v1` klasik yang dipakai `Gemini::HttpClient`. User generate key baru dari
aistudio.google.com/apikey (key gaya AI Studio biasa, project sama `gen-lang-client-0216186805`).

Yang saya lakukan:
1. Update `GEMINI_API_KEY` di `api/config/application.yml` (local, gitignored — key tidak
   pernah masuk git).
2. Restart Puma + Sidekiq (dua proses terpisah, keduanya baca env var ini saat boot).
3. Retry Portfolio dari UI assessor → log: `[N10] Portfolio generated for session 2` ✅
4. Screenshot Portfolio Results: skill ratings + evidence quotes + competency summary +
   "Discovered Skills" (skill di luar assessment awal yang ke-probe AI, dengan confidence
   badge) + tombol "Run Fit/Gap Analysis" sekarang aktif.

**Catatan penting:** Coverage analysis (N7) untuk session 2 gagal SAAT interview asli
berlangsung (masih pakai key lama) — Portfolio generator ternyata bisa jalan dari transcript
tersimpan terlepas dari itu, tapi Coverage/Live-Monitor real-time belum terbukti jalan
dengan key baru karena belum ada interview baru yang dijalankan sesudah fix ini. Perlu
interview baru untuk klaim STEP Coverage/Live-Monitor sebagai PASS penuh.

---

# STEP 04

**ROLE:** Assessor

**PAGE:** Portfolio Results (Budi) → dropdown "Choose vacancy..." → Vacancies (`/vacancies`)
→ New Vacancy → kembali ke Portfolio Results → Fit/Gap Report.

**USER ACTION:** User coba pilih vacancy di dropdown "Choose vacancy..." untuk jalankan
Fit/Gap Analysis, dropdown-nya kosong ("choose vacancy masih belum bisa").

**EXPECTED:** Dropdown berisi daftar vacancy yang bisa dipilih.

**ACTUAL:** **Ini bukan bug** — `GET /api/v1/vacancies?page=1` mengembalikan
`{"vacancies":[],"total_count":0}` karena **memang belum ada satu pun vacancy dibuat** di
tenant ini. Dikonfirmasi di halaman `/vacancies`: UI sudah benar menampilkan empty state
"No vacancies yet." + tombol "Create your first vacancy" — cuma empty state itu tidak
kelihatan dari dropdown di halaman Portfolio (dropdown kosong begitu saja, tanpa hint/link
ke "buat vacancy dulu"). Saya buat 1 vacancy test ("Flutter Engineer", skill: React/Frontend
Development Core level L3) supaya bisa lanjut testing Fit/Gap.

**STATUS:** ✅ Bukan bug (missing seed data, sudah di-unblock). 🟡 Observasi UX minor
(lihat Bug table B-03) — bukan blocker, bukan urgent.

---

**⚠️ CATATAN JUJUR — kesalahan saya sendiri saat testing:**

Sewaktu saya coba klik dropdown "Choose vacancy..." (sebelum tau itu kosong), salah satu
klik saya nyasar ke panel "Override rating" yang sedang terbuka di komponen "Micro-frontend
Architecture" di atasnya — akibatnya rating candidate ini **kesimpan sebagai L2 dengan
catatan "sds"** (jelas bukan input manusia, hasil salah klik otomatis saya). Saya baru sadar
pas kembali ke halaman ini dan lihat badge "Overridden ✓".

**Saya sudah perbaiki**: buka lagi "Edit override", set balik ke L3 (sama dengan rating AI
semula), hapus catatan "sds", Save. Nilainya sekarang benar (L3 = L3), TAPI audit trail-nya
tetap akan menunjukkan "Overridden by You" — sistem tidak punya cara "batalkan override
sepenuhnya" dari UI, cuma bisa timpa dengan nilai baru. Kalau ini data yang bakal dipakai
buat laporan/screenshot resmi, baik untuk tahu asal-usulnya bukan keputusan assessor
sungguhan. Saya lebih hati-hati soal ref vs koordinat klik setelah ini.

---

**TRACE (Fit/Gap)**
```
ASSESSOR
 ↓ (pilih vacancy, klik "Run Fit/Gap Analysis")
FRONTEND → POST /api/v1/... (fit/gap generate)
 ↓
SIDEKIQ WORKER → Gemini::HttpClient → GEMINI API (model Flash, key baru)
 ↓
FitGapReport tersimpan (skill comparison, culture fit narrative, discovered skills)
 ↓
UI → render "Fit/Gap Report": React/Frontend Development Core → Candidate L3 vs
     Required → ✅ Match. Micro-frontend Architecture ditandai "not in vacancy
     requirements, may be additive".
```

**VERIFICATION**
- Screenshot "Fit/Gap Report" — dilihat langsung, isi masuk akal & konsisten dengan
  Portfolio (L3 React, discovered skill Micro-frontend Architecture).
- Ini juga jadi verifikasi tambahan kalau fix B-02 (Gemini key) memang menyeluruh — bukan
  cuma Portfolio yang jalan, Fit/Gap (client Gemini yang sama) juga sukses generate.
- Belum dites: apakah ada halaman "Confidence" TERSENDIRI di luar badge yang nempel di
  Portfolio/Fit-Gap. Belum dites: Live Monitor & Coverage real-time (masih perlu interview
  baru, lihat catatan di STEP 03).

---

**PERBAIKAN — B-03 (empty-state vacancy dropdown, bukan cuma dicatat, sekarang di-fix):**

Root-cause-nya sudah benar dari STEP 04 (bukan bug, memang belum ada vacancy), tapi produk
seharusnya **membimbing** assessor keluar dari kebuntuan itu, bukan cuma nampilin dropdown
kosong tanpa penjelasan:

```
SEBELUM:
VACANCY DROPDOWN → GET /vacancies → [] → tidak ada vacancy → dropdown kosong,
                                                                tombol "Run Fit/Gap" disabled
                                                                selamanya, TANPA penjelasan
 ↓ USER POV
"Saya ingin membuat Fit/Gap, tapi saya tidak tahu harus ngapain — dropdown-nya kosong
begitu saja, tidak ada tombol, tidak ada pesan."

SESUDAH:
VACANCY DROPDOWN → GET /vacancies → [] → tidak ada vacancy → blok "Fit/Gap" berubah jadi
                                                                empty-state: ikon + "No
                                                                vacancies to compare against"
                                                                + penjelasan singkat + tombol
                                                                "Create your first vacancy"
                                                                (langsung ke /vacancies/new)
 ↓ USER POV
"Oh, saya perlu bikin vacancy dulu. Tinggal klik tombolnya."
```

**Perubahan:** [PortfolioPage.tsx:234-260](../web/src/pages/portfolio/PortfolioPage.tsx#L234)
— blok "Fit/Gap" sekarang cek `vacancies.length === 0` dan render empty-state (ikon
`Briefcase`, judul, subteks, tombol `Create your first vacancy` → `navigate("/vacancies/new")`)
alih-alih `<Select>` kosong + tombol yang disabled tanpa penjelasan. Pola visualnya (border
rounded container, ikon + judul + subteks + CTA outline button) diambil konsisten dari
empty-state yang sudah ada di `VacancyListPage.tsx` dan `AssessmentInvitePage.tsx` — bukan
komponen baru, codebase ini belum punya `EmptyState` reusable, jadi ikut konvensi ad-hoc yang
sudah dipakai di 2 halaman lain.

**VERIFICATION:**
1. `npx tsc --noEmit` — bersih, tidak ada type error baru.
2. Hapus sementara vacancy test via `rails runner` (`Vacancy.find(1).destroy`) untuk
   memaksa kondisi `vacancies.length === 0` yang sesungguhnya.
3. Reload halaman Portfolio Results (Budi) → screenshot: empty-state baru tampil persis
   seperti dirancang (ikon Briefcase, "No vacancies to compare against", tombol "Create
   your first vacancy").
4. Klik tombolnya → berhasil navigasi ke `/vacancies/new` (bukan dead-end).
5. Buat ulang vacancy "Flutter Engineer" (skill sama: React/Frontend Development Core, L3)
   lewat UI untuk mengembalikan state seperti semula — dikonfirmasi muncul lagi di
   `/vacancies`, tidak ada data yang hilang permanen dari eksperimen verifikasi ini.

**Scope note:** ini genuinely improvement (bukan cuma minimal-fix-buat-lanjut-testing) —
disimpan terpisah dari B-01/B-02 yang murni exploration blocker, karena ini murni product
polish/initiative yang diminta secara sadar, bukan sekadar buka jalan eksplorasi.
