# Step 2 — Deep Context & Domain Immersion

Sumber: brief + 2 PRD (wiki) + full codebase `api/` & `web/` + eksplorasi runtime.

---

## Pilar 1 — The Product (dipakai end-to-end)

**Produk:** AI-powered skills assessment interview. AI (Gemini Live) mewawancarai kandidat via suara real-time, lalu menilai kompetensi mereka per skill (L1–L5), dan menghasilkan laporan fit-gap terhadap kebutuhan job.

**Arsitektur 2 service:**
- `api/` — Rails 7.0.10, PostgreSQL, Redis, Sidekiq, WebSocket (Faye/EventMachine), Gemini (Live + Flash + Pro)
- `web/` — React 18 + TS + Vite + Tailwind + Radix UI

**Alur produk (verified di runtime):**
1. **Assessor** buat assessment (nama, durasi 10–90 menit, bahasa en/id, skill + expected level L1–L5) — `AssessmentNewPage`
2. Worker generate **system prompt** (10KB) dari config skill — `SystemPromptCompiler` (murni string interpolation, tanpa LLM)
3. **Invite**: bikin session → `invite_url` + `invite_token` dikirim ke kandidat — `AssessmentInvitePage`
4. **Kandidat** buka link → hardware check (mic/speaker/internet) → interview suara live:
   - Audio proxy 16kHz→24kHz antara browser & Gemini Live
   - **Coverage map** dilacak tiap turn (not_yet→initiated→partial→covered) via Gemini Flash async
   - AI di-bisiki hidden metadata (sisa waktu, pacing, priority_next) tiap turn
   - Auto-end saat semua skill covered / time ceiling / manual
5. **Portfolio**: sesudah interview, Gemini Pro nilai tiap skill (level, confidence, evidence, summary) — 2 menit
6. **Assessor review**: koreksi level AI via override + catatan
7. **Fit-Gap**: bandingkan portfolio vs vacancy (rule-based) + narasi AI — laporan + export PDF

**Filosofi kunci (PRD 01):** "AI harus berperilaku seperti interviewer manusia yang terampil" — probe jawaban, tantang klaim, discover skill tak terduga, natural transition. Ini *the most important document* — semua data model & UI melayani perilaku ini.

**Sisi engineering yang menonjol:** sistem coverage (StateEngine + Analyzer + MapInjector) = mekanisme akuntabilitas AI. Reconnect handling Gemini (resumption token, silence pump, anti-echo gate, graceful browser disconnect) = engineering real-time matang.

---

## Pilar 2 — The Industry (talent assessment Indonesia)

**Konteks:**
- Hiring di Indonesia volume besar, proses manual: screening → interview → assessment. Mahal & lambat.
- **Assesment konvensional sudah komoditas**: psikotes (PAPI, DISC, dll), take-home test, platform online assessment generik. Banyak vendor, sedikit diferensiasi.
- **Leverage sebenarnya = wawancara mendalam & penilaian kompetensi yang konsisten.** Skill behavioral L1–L5 + evidence-based rating adalah yang belum dikomoditasi.
- AI voice interview = efisiensi biaya (scale) + konsistensi (semua kandidat dinilai dengan standar yang sama) vs interview manusia (bias, tidak konsisten, mahal).
- Bahasa: pasar Indonesia butuh dukungan **Bahasa Indonesia** (sudah ada `language: id`) — keunggulan lokal.
- Regulasi: **UU PDP No. 27/2022** — data pribadi kandidat (audio, transkrip, penilaian) wajib dilindungi. Ini semakin krusial dan jadi diferensiator pembeli enterprise.

---

## Pilar 3 — What It Is For (outcome)

**Outcome yang harus dihasilkan produk:**
> Memberikan penilaian kompetensi kandidat yang **akurat, adil, dan bisa dipertanggungjawabkan** pada skala yang tidak bisa dicapai interviewer manusia.

**Yang harus benar agar terus berguna:**
1. **Kualitas penilaian** — rating AI harus benar-benar mencerminkan kemampuan (kalau salah, pembeli kehilangan kepercayaan)
2. **Keadilan proses** — coverage map memastikan tiap skill digali minimal 2x (anti-asal-asalan)
3. **Kontrol manusia** — assessor override = kesempatan koreksi, membangun trust
4. **Kepastian teknis** — interview tidak boleh putus/kehilangan data (reconnect, resumption)
5. **Kepatuhan** — UU PDP, data aman

**Agar lebih banyak orang terpakai (belum tercapai):**
- Self-serve assessment tanpa assessor manual
- Integrasi ATS / pipeline rekrutmen
- Laporan yang bisa dipertanggungjawabkan secara legal (audit trail, consent)
- Analisis tren skillset (data agregat anonim)

---

## Pilar 4 — The Users (assessor, recruiter, hiring manager)

**Assessor / HR lead:**
- Sehari-hari: konfigurasi assessment, kirim undangan, pantau interview, review hasil, putuskan lanjut/tidak
- Pain: manual interview makan waktu; penilaian manusia bias & tidak konsisten; susah membuktikan "kenapa lulus/tidak lulus"
- Produk ini menjawab: bikin assessment sekali → AI wawancara banyak kandidat → hasil + bukti (evidence quotes) + fit-gap ke job

**Recruiter:**
- Sehari-hari: sourcing, screening, koordinasi interviewer
- Pain: bottleneck di tahap interview; susah bandingin kandidat secara fair
- Nilai produk: pipeline lebih cepat, perbandingan kandidat konsisten (semua pakai standar L1–L5 sama)

**Hiring manager:**
- Sehari-hari: butuh tau "orang ini bisa bikin tim saya lebih baik gak?"
- Pain: laporan yang panjang/ambigu; keputusan yang tak bisa dijelaskan
- Nilai produk: fit-gap report (match/gap/exceed + narasi) → keputusan cepat & defensible

---

## Pilar 5 — The People Who Never Chose It (kandidat)

**Fakta:** kandidat TIDAK memilih produk ini. Assessor yang memutuskan. Kandidat hanya menerima link invite. Tidak bisa opt-out. **Salah hasil = mengubah setahun hidup orang** (gagal dapat pekerjaan yang mereka butuhkan).

**Implikasi desain & UU PDP (yang saat ini KURANG di produk):**

| Aspek | Kondisi sekarang | Celah |
|---|---|---|
| Transparansi data | Tidak ada penjelasan data apa yang dikumpulkan (audio direkam, ditranskrip, dianalisis AI) | **Gap besar** |
| Consent | Tidak ada persetujuan eksplisit pemrosesan data pribadi | **Gap besar** |
| Hak akses/hapus | Tidak ada jalur kandidat minta salinan/hapus datanya | **Gap** |
| Audio storage | Tidak jelas berapa lama audio/transkrip disimpan, siapa akses | **Gap** |
| Notifikasi hasil | Layar selesai minim: "hiring team will follow up" | UX gap |
| Keadilan proses | Coverage map = jaminan tiap skill digali | ✅ Bagus |

**UU PDP yang relevan (No. 27/2022):**
- Pasal 5: pemrosesan data pribadi wajib persetujuan (consent)
- Pasal 19–20: hak subjek data (akses, perbaikan, penghapusan)
- Pasal 29–30: kewajiban pelindungan & keamanan data
- Pasal 36–39: pengendali data wajib buktikan kepatuhan, sanksi administratif
- Data kandidat di sini = data pribadi (nama, suara/biometrik, transkrip, penilaian) → kategori sensitif untuk audio

---

## Temuan lintas-pilar (bekal Step 3)

Berikut gap yang sudah terlihat dari deep dive (belum diverifikasi penuh — Step 3 nanti diverifikasi dgn test/DB):

1. **Tidak ada consent/transparansi UU PDP di alur kandidat** (P2) — kandidat masuk interview tanpa tahu datanya diproses gimana
2. **`invite_url` salah host** — mengarah ke port backend (3001) bukan frontend (5173) → link kandidat broken di deploy tertentu (P1)
3. **Error response bocor stack trace** (`exception` + `traces` di JSON) (P2)
4. **Anchor field wajib manual** walau skill dari taxonomy — duplikasi data & friction (P2)
5. **Signup tidak ada di backend** tapi ada di frontend service (`/signup` tidak ter-route) — fitur hilang/missing spec (P3)
6. **Race condition** response "system_prompt_generated: true" sebelum worker selesai (P3)
7. **Tipe mismatch** frontend vs backend: `PortfolioSkill.ai_level` string "L1" di TS vs integer di API; `SkillComparison.required_level` vs `expected_level` (P2)
8. **JWT di localStorage**, tenant resolution tanpa verifikasi signature, `X-Tenant-Scheme` bebas (dari audit — P1)
9. **invite_token** di-respons assessor + via URL (P2)
10. **Transkrip kandidat cuma 10 turn terakhir** — kandidat tak bisa scroll balik (UX, P3)
11. **Monolith logic real-time 1200+ baris tanpa test** — regression risk tinggi (P1 engineering)
12. **Tidak ada test sama sekali** (RSpec kosong, web tanpa runner, tanpa CI) — baseline brief

---

## Constraint Signal (untuk Step 3)

- **Blokir potensial:** sistem real-time (audio WebSocket) sangat kompleks & tanpa test — perubahan harus hati-hati; resumption token & sinkronisasi Redis pub/sub rapuh saat scale-out.
- **Ambiguity:** tidak jelas alur signup user (sistem user assessment tidak ada di produk); target skala (berapa kandidat paralel?) tidak terdokumentasi.
- **Architectural debt:** semua logic WebSocket di 1 file 803 baris; EventMachine single-thread; tenant scoping bergantung pada JWT tak terverifikasi.
