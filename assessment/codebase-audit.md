# Audit Teknis Codebase — AI Interview Platform

Disusun sebagai audit awal sebelum revamp strategy. Semua temuan diverifikasi langsung ke
kode (file + baris) per tanggal audit ini. Sumber kebenaran spesifikasi produk adalah wiki
repo (`ai-interview-platform.wiki`), bukan ringkasan yang ditulis di prompt awal.

**Catatan penting soal sumber wiki:** wiki hanya berisi 3 halaman: `Home.md` (kosong, cuma
judul), `PRD-01 — First Principles: AI Interview Behavior.md`, dan
`PRD-02 — Real Simulation: End-to-End Interview.md`. Tidak ada PRD-03, tidak ada halaman
data model/API spec terpisah. Jadi seluruh perbandingan di bawah ini merujuk ke dua dokumen
itu saja — kalau ada aspek implementasi yang tidak dibahas eksplisit di salah satu dari
keduanya, itu saya tandai sebagai "tidak dispesifikasikan" bukan "menyimpang".

---

## 1. Ringkasan Arsitektur Existing

### Temuan utama sebelum masuk detail
Codebase ini **jauh lebih matang** daripada yang diimplikasikan brief case study ("baseline
belum ada spec sama sekali"). Klaim soal nol test terkonfirmasi benar (lihat §5), tapi itu
satu-satunya bagian yang benar-benar kosong. Hampir seluruh mekanisme inti di PRD-01/PRD-02
— termasuk bagian yang secara teknis rumit seperti WebSocket reconnection dengan session
resumption, hard-rule enforcement untuk `probe_count >= 2` di level kode (bukan cuma prompt),
dan rate limiting — **sudah diimplementasikan**, beberapa di antaranya melebihi spek PRD.
Temuan paling serius bukan "fitur belum ada", tapi sejumlah kecil bug/gap yang presisi dan
tersembunyi (lihat §2 dan §6).

### 1.1 Struktur `api/` (Rails 7 + PostgreSQL + Sidekiq)

```
api/app/
  auth/authorize_api_request.rb        → decode JWT, cek role, TIDAK query DB user
  channels/
    audio_websocket_middleware.rb      → proxy WS kandidat ↔ Gemini Live (inti produk, 803 baris)
    coverage_websocket_middleware.rb   → WS server-push ke assessor (U5)
  clients/gemini/
    live_client.rb                     → WebSocket client ke Gemini Live API (488 baris)
    http_client.rb                     → REST client untuk Gemini Flash/Pro (N7, N10, N13)
  controllers/api/v1/                  → 8 controller, semua REST standar Rails
  lib/
    audio_ring_buffer.rb               → circular buffer PCM (lihat temuan §2 item 11 — TIDAK dipakai)
    json_web_token.rb, message.rb
  middlewares/
    tenant_resolver_middleware.rb      → resolve Organization dari JWT/header/referer
    auth_token_middleware.rb
  models/          → 14 model AR, lihat §3
  services/
    assessments/system_prompt_compiler.rb  → N2
    coverage/{analyzer,map_injector,state_engine}.rb → N7, B6, state machine
    portfolios/generator.rb                → N10
    fit_gap/engine.rb                      → N13
    exports/pdf_generator.rb               → N14 (pakai Prawn)
    sessions/{start_handler,end_handler}.rb → N5, N9
  workers/         → 4 Sidekiq worker (coverage_analyzer, portfolio_generator,
                     fit_gap_generator, system_prompt_generator) — TIDAK ADA app/jobs,
                     semua pakai Sidekiq::Worker langsung di app/workers/
```

Tidak ada folder `spec/` sama sekali (dikonfirmasi via `find`), meski `api/.rspec` dan gem
testing (`rspec-rails`, `factory_bot_rails`, `database_cleaner`, `timecop`) sudah ada di
`Gemfile:46-63`. Detail di §5.

**Konteks arsitektur penting:** aplikasi ini **berbagi database PostgreSQL** dengan sistem
eksternal bernama "rakamin-api" (disebutkan di banyak komentar kode, mis.
`api/app/models/organization.rb:3-5`, `api/config/database.yml:1-3`,
`api/README.md:22`). Tabel `organizations` hidup di schema `public` milik rakamin-api;
semua tabel AI interview hidup di schema `ai_interview` terpisah
(`api/db/migrate/20240101000000_create_ai_interview_schema.rb:7-11`). `SECRET_KEY_BASE`
harus sama persis dengan rakamin-api supaya JWT lintas sistem valid
(`api/app/lib/json_web_token.rb:3-4`, `api/README.md:22`). Ini bukan produk yang berdiri
sendiri secara data — perubahan skema/auth harus mempertimbangkan kompatibilitas dengan
sistem itu meskipun reponya tidak ada di sini.

### 1.2 Alur request/response inti (candidate interview)

1. Assessor bikin `Assessment` + `AssessmentSkill` lewat REST API →
   `SystemPromptGeneratorWorker` (async) compile system prompt (N2).
2. Assessor bikin `Session` (invite link) → `invite_token` 256-bit random
   (`api/app/models/session.rb:35-37`).
3. Kandidat buka `/interview/:token` (React, publik, tanpa JWT) → hit
   `GET /sessions/:token/candidate` → connect ke `/ws/sessions/:id/audio` (custom Rack
   middleware, **bukan** ActionCable — `api/app/channels/audio_websocket_middleware.rb`
   pakai `faye-websocket` langsung di level Rack, di-mount sebelum
   `TenantResolverMiddleware` — `api/config/initializers/websocket.rb:14-15`).
4. Middleware itu jadi **proxy dua arah**: audio PCM dari browser diteruskan ke Gemini Live
   WS (`Gemini::LiveClient`), audio balasan Gemini diteruskan balik ke browser. Setiap kali
   Gemini mengirim `inputTranscription` (kandidat selesai bicara), middleware: (a) inject
   coverage map yang di-cache, (b) simpan `TranscriptTurn`, (c) enqueue
   `CoverageAnalyzerWorker` (N7, async).
5. `CoverageAnalyzerWorker` panggil Gemini Flash, update `CoverageMap` rows, publish ke Redis
   pub/sub channel `coverage:{session_id}`.
6. `CoverageWebSocketMiddleware` (WS terpisah, `/ws/sessions/:id/coverage`) subscribe ke
   channel Redis itu dan forward ke dashboard assessor (U5) — real-time, bukan polling.
7. Saat semua skill `covered`, middleware audio memicu urutan wrap-up → `Sessions::EndHandler`
   (N9) → `PortfolioGeneratorWorker` (N10, Gemini Pro) → assessor buka halaman portfolio,
   pilih vacancy, `FitGapGeneratorWorker` (N13) jalan on-demand → PDF export (N14).

### 1.3 Implementasi WebSocket ke Gemini Live — bagaimana sebenarnya

**Bukan** ActionCable, **bukan** simulasi. `api/app/clients/gemini/live_client.rb`
membuka koneksi asli ke
`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`
(baris 10) pakai gem `faye-websocket`, jalan di reactor EventMachine
(`api/config/initializers/eventmachine.rb` — reactor start; lihat juga penggunaan `EM.add_timer`
di seluruh `audio_websocket_middleware.rb`). Detail payload setup, silence-pump untuk trigger
VAD Gemini, proactive reconnect sebelum limit sesi Gemini tercapai, dan echo-cancellation gate
semuanya diimplementasikan — jauh melebihi apa yang PRD-02 gambarkan secara eksplisit.

### 1.4 Job yang benar-benar ada di Sidekiq

Dikonfirmasi dari `api/app/workers/*.rb` (4 file, semua `include Sidekiq::Worker`):

| Worker | Queue | Retry | Memicu | Pemetaan PRD |
|---|---|---|---|---|
| `SystemPromptGeneratorWorker` | default | 3 | Assessment create/update | N2 |
| `CoverageAnalyzerWorker` | coverage | **0** (sengaja, non-critical) | Setiap turn kandidat | N7 |
| `PortfolioGeneratorWorker` | portfolio | 3 | Session end | N10 |
| `FitGapGeneratorWorker` | default | 2 | Assessor klik "Run Fit/Gap" atau override | N13 |

### 1.5 Struktur `web/` (React 18 + TS + Vite)

```
web/src/
  hooks/  useAudioCapture.ts, useAudioPlayback.ts   → AudioWorklet PCM 16kHz
          useAudioWebSocket.ts                       → WS audio ke backend + reconnect logic
          useCoverageWebSocket.ts                    → WS coverage ke backend (U5 consumer)
  pages/  interview/InterviewPage.tsx      → kandidat (state machine idle→...→complete)
          monitor/LiveMonitorPage.tsx      → assessor live monitor (U5)
          portfolio/PortfolioPage.tsx      → U7
          fitgap/FitGapReportPage.tsx      → U10
          assessments/, vacancies/, auth/
  services/  api.ts (axios + interceptor JWT), sessions.ts, portfolios.ts, assessments.ts, vacancies.ts
  stores/    authAtom.ts (Jotai, token di localStorage)
```

Tidak ada satu pun file test (`*.test.tsx`, `*.spec.tsx`), tidak ada Vitest/Jest di
`package.json`. Detail §5.

---

## 2. Perbandingan Klaim PRD vs Implementasi

Klasifikasi: **[SESUAI]** / **[ADA TAPI RUSAK/PARSIAL]** / **[BELUM ADA SPEK/IMPLEMENTASI]**

| # | Item | Klasifikasi | Bukti |
|---|---|---|---|
| 1 | Generasi system prompt dari config skill (N2) | **[SESUAI]** | `api/app/services/assessments/system_prompt_compiler.rb` (seluruh file) — mengikuti struktur PRD-01 §2 persis (agenda, rules, coverage guidance, tone, opening). Dipicu dari `api/app/controllers/api/v1/assessments_controller.rb:33,43` via `SystemPromptGeneratorWorker`. **Melebihi spek**: menambah section "PACING DISCIPLINE" (baris 182-204) dan "SIGNAL AUTHENTICATION" anti prompt-injection (baris 148-152) yang tidak ada di PRD, plus dukungan bahasa EN/ID (baris 27-36) yang juga tidak ada di PRD. |
| 2 | Pembuatan invite link + session record | **[SESUAI]** | `api/app/models/session.rb:14` (`validates :invite_token, uniqueness`), `:35-37` (`SecureRandom.hex(32)`), `:28-31` (`invite_url`). Endpoint create di `api/app/controllers/api/v1/sessions_controller.rb:21-44`. Sesuai N4 di PRD-02. |
| 3 | Setup WebSocket Gemini Live (voice, response modality, transcription, session_resumption) | **[SESUAI]** | `api/app/clients/gemini/live_client.rb:306-333` (`send_setup`) — `responseModalities: ['AUDIO']`, `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` (default `'Puck'`, baris 27), `inputAudioTranscription: {}`, `outputAudioTranscription: {}`, `contextWindowCompression.slidingWindow: {}`, `sessionResumption`. Cocok field-per-field dengan payload contoh di PRD-02 Phase 2. Nama model berbeda (`gemini-3.1-flash-live-preview` vs contoh PRD `gemini-2.0-flash-live`) — itu wajar (drift versi model), bukan penyimpangan implementasi. |
| 4 | Coverage map injection sebagai `clientContent` SEBELUM respons AI (B6) | **[ADA TAPI RUSAK/PARSIAL]** | **Timing benar**: `api/app/channels/audio_websocket_middleware.rb:174-199` (`build_on_input_transcription`) memanggil `maybe_inject_coverage` (baris 180, definisi baris 203-211) sinkron, sebelum Gemini sempat merespons — persis urutan yang digambarkan PRD-01 §3. **Channel-nya SALAH**: PRD-01 §3 eksplisit minta `clientContent` dengan `role: "user"` (referensi ke `BidiGenerateContentClientContent`), tapi implementasi kirim lewat `realtimeInput.text` (`api/app/clients/gemini/live_client.rb:92-97`, komentar developer sendiri: "same channel as audio"). **Bukti dampak nyata**: ada fungsi `sanitize_output_transcription` (`api/app/channels/audio_websocket_middleware.rb:271-283`) — 8 pola regex untuk membuang JSON `[COVERAGE_MAP]`/`[TIME_CONTROL]` yang **bocor ke transkrip ucapan AI**. Komentar di baris 271 secara eksplisit bilang ini "leaks into output transcription via realtimeInput.text echoes". Artinya requirement PRD "NOT spoken — invisible to the candidate" **pernah/bisa gagal** dan ditambal dengan regex, bukan diperbaiki di akar masalah. |
| 5 | Coverage analyzer async (N7) + aturan `probe_count >= 2` sebelum naik state | **[SESUAI]**, melebihi spek | Worker: `api/app/workers/coverage_analyzer_worker.rb`. Service: `api/app/services/coverage/analyzer.rb` (window 6 turn terakhir, sesuai `TURNS_CONTEXT = 6` baris 8, sama seperti PRD). Aturan keras **ditegakkan dua kali**: di teks prompt (baris 69-71) **dan** di kode Ruby via `Coverage::StateEngine.valid_transition?` (`api/app/services/coverage/state_engine.rb:17-26` — `return false if probe_count < 2`). Ini defense-in-depth yang PRD sendiri tidak minta — walau LLM "berbohong" soal skor, state tidak akan naik di database. |
| 6 | Deteksi discovered skills | **[SESUAI]** | `api/app/services/coverage/analyzer.rb:158-165` (`parse_discovered`) + `api/app/workers/coverage_analyzer_worker.rb:51-65` (`create_discovered_skills`, dibatasi maksimal 10 discovered skill per sesi — proteksi yang masuk akal, tidak ada di PRD tapi tidak bertentangan). |
| 7 | Push realtime ke assessor live monitor saat state berubah (U5) | **[SESUAI]** | `api/app/workers/coverage_analyzer_worker.rb:67-82` (`publish_coverage_update`) publish ke Redis `coverage:{session_id}` setiap kali N7 selesai. `api/app/channels/coverage_websocket_middleware.rb` subscribe & forward ke browser. Frontend: `web/src/hooks/useCoverageWebSocket.ts` + `web/src/pages/monitor/LiveMonitorPage.tsx:194-266` render progress bar per skill + `last_signal` + probe count secara live. Catatan kecil: publish terjadi di setiap run N7, bukan hanya saat state benar-benar berubah — bukan bug, hanya sedikit boros. |
| 8 | Portfolio generator (N10) — LLM dengan full transcript + coverage map final, evidence quotes, confidence | **[ADA TAPI PARSIAL]** | `api/app/services/portfolios/generator.rb:41-125` (`build_prompt`) mengirim full transcript + final coverage map + skill anchors ke Gemini Pro, sesuai PRD-01 §5 dan PRD-02 Phase 4. Evidence dibatasi 3 quote (`Array(skill_data['evidence']).first(3)`, baris ~163/175). **Gap**: formula confidence PRD (`high = probe_count>=3 AND covered`, dst) **hanya ada di teks prompt** (baris 97-100) — di kode, `save_skills` (baris 150-179) menulis `ai_confidence: skill_data['confidence']` **langsung dari output LLM tanpa verifikasi ulang** terhadap `probe_count` yang sebenarnya tersimpan di `coverage_maps`. Beda dengan item #5 di atas yang aturan kerasnya ditegakkan dua kali di kode — di sini hanya dipercayakan ke LLM sepenuhnya. |
| 9 | Fit/Gap engine (N13) — perbandingan rule-based + narasi budaya kerja LLM | **[ADA TAPI PARSIAL]** | Perbandingan level **rule-based di kode** (bukan LLM) — `api/app/services/fit_gap/engine.rb:39-70` (`build_skill_comparisons`, match/gap/exceed dari delta), termasuk sadar akan assessor override (`effective_portfolio_skills`, baris 73-86). Ini SESUAI dan solid. **Gap** pada bagian narasi: PRD-01 §5 & PRD-02 Phase 5 bilang input LLM untuk narasi budaya adalah "vacancy culture_dimensions + portfolio competency summaries" — tapi `build_narrative_prompt` (baris 111-139) **tidak pernah menyertakan** teks `competency_summary` dari `portfolio_skills`, hanya kirim angka level + delta. Bukti kuat: variabel lokal `portfolio_session` dan `assessment` (baris 113-114) **dihitung tapi tidak pernah dipakai** di prompt akhirnya — indikasi kuat integrasi ini belum selesai dikerjakan. |
| 10 | Export PDF hasil fit/gap (N14) | **[SESUAI]** | `api/app/services/exports/pdf_generator.rb` (173 baris, pakai gem `prawn`/`prawn-table`) — render header, skill cards (dengan override AI→Assessor jika ada), tabel fit/gap, narasi budaya & overall, footer nomor halaman. Dipicu dari `api/app/controllers/api/v1/portfolios_controller.rb:60-68`. Frontend request+download di `web/src/pages/portfolio/PortfolioPage.tsx:66-95` dan `FitGapReportPage.tsx:76-94`. Lengkap dan cocok dengan U10/N14. |
| 11 | WebSocket reconnection / session resumption saat GoAway | **[SESUAI]**, dengan satu catatan | Mekanisme inti solid: `api/app/channels/audio_websocket_middleware.rb:348-373` (`handle_go_away`) baca `resumption_token`, buka client Gemini baru dengan `sessionResumption: {handle: ...}` (`live_client.rb:330`), baru tutup koneksi lama — persis simulasi PRD-02 "WebSocket Reconnection Simulation". Bahkan ditambah **proactive reconnect** ~8.5 menit sebelum limit Gemini tercapai (`schedule_proactive_reconnect`, baris 444-451) — fitur robustness di luar spek PRD. **Catatan**: `api/app/lib/audio_ring_buffer.rb` — class lengkap & terdokumentasi untuk "replay audio setelah reconnect" — **tidak dipanggil dari mana pun** (`grep -rn "AudioRingBuffer"` hanya menemukan file definisinya sendiri). Komentar di `handle_gemini_close` yang menyebut "Audio is buffered during the gap and replayed" **tidak benar** — potongan audio kandidat yang terucap persis saat gap reconnect kemungkinan hilang, bukan di-replay. |

**Ringkasan §2:** dari 11 item, **7 SESUAI** (beberapa melebihi spek), **4 ADA TAPI
PARSIAL**, **0 sama sekali belum ada**. Tidak ada satu pun item PRD inti yang benar-benar
tidak tersentuh implementasinya.

---

## 3. Temuan dari Inspeksi Data

**Tidak bisa menjalankan query langsung** — tidak ada PostgreSQL/Docker yang berjalan di
environment audit ini (`pg_isready`/`psql`/`docker ps` semua gagal connect). Temuan di bawah
berbasis `db/schema.rb` (version `2026_05_05_000002`) dan seluruh riwayat migrasi
(7 file di `db/migrate/`) — **bukan** hasil query aktual. Kalau ada data production/seed yang
menyimpang dari skema ini, itu tidak akan terlihat dari audit ini.

- **Skill dan coverage map disimpan sebagai baris relasional, bukan JSON blob mentah.**
  PRD menampilkan skill dan coverage map sebagai contoh JSON (untuk system prompt / payload
  WS), tapi secara fisik tersimpan sebagai tabel ternormalisasi:
  `assessment_skills` (`db/schema.rb:28-44`) dan `coverage_maps` (`:71-83`), masing-masing
  satu baris per skill per assessment/session. Ini **bukan penyimpangan** — itu keputusan
  desain yang wajar (query-able, punya index, punya unique constraint per
  `session_id + skill_label`) dan tetap menghasilkan bentuk JSON yang sama saat
  di-serialize untuk prompt/WS (lihat `Coverage::MapInjector#skill_json`,
  `api/app/services/coverage/map_injector.rb:62-69`).
- **Riwayat migrasi bersih, tidak ditemukan migrasi setengah jalan.** 7 migrasi, urut logis:
  buat schema inti (2 migrasi awal) → tambah skill taxonomy & users → tambah bahasa → tambah
  opsi 10 menit ke time limit → tambah index → tambah nama kandidat. Semua migrasi
  reversible (punya `down` atau pakai `change`), tidak ada yang isinya kosong/`TODO`/comment
  "temporary".
- **Satu redundansi kecil**: `db/migrate/20260505000000_add_indexes_to_organizations.rb`
  menambahkan index yang **sudah dibuat** di migrasi paling awal
  (`20231201000000_create_organizations.rb:17-18`). Dijaga dengan
  `unless index_exists?` jadi aman dijalankan, tapi mengindikasikan tabel `organizations`
  kadang dikelola di luar migration history AI-interview ini (masuk akal karena tabel itu
  milik sistem rakamin-api yang dibagi).
- **Enum `fit_result`** (`match/gap/exceed/not_assessed`, `db/schema.rb:23`) didefinisikan di
  database tapi **tidak dipakai mengikat kolom manapun** — hasil perbandingan fit/gap
  disimpan sebagai string biasa di dalam `fit_gap_reports.skill_comparisons` (jsonb,
  `:88`). Trivia, bukan bug — kemungkinan sisa desain awal sebelum diputuskan pakai JSONB.
- **Constraint check konsisten dengan aturan produk**: `assessment_skills.expected_level`
  dan `portfolio_skills.ai_level` dibatasi 1-5 di level database
  (`chk_assessment_skills_expected_level`, `chk_portfolio_skills_ai_level`), bukan cuma di
  validasi Rails — proteksi ganda yang baik.
- **Tidak ada kolom/tabel apa pun untuk retensi atau soft-delete** pada `sessions`,
  `transcript_turns`, `coverage_maps`, `portfolios`, atau `portfolio_skills` — tidak ada
  `deleted_at`, tidak ada `expires_at`, tidak ada `purged_at`. Detail dampak di §4.

---

## 4. Temuan Audit UU PDP & Keamanan

### 4.1 Otorisasi endpoint — TEMUAN P0

**Empat model tidak ikut skema multi-tenant** yang dipakai model lain di aplikasi yang sama.
`Assessment`, `Session`, dan `Vacancy` semuanya `include TenantScoped`
(`api/app/models/assessment.rb:4`, `session.rb:4`, `vacancy.rb:4`) — modul ini memasang
`default_scope` yang otomatis memfilter query berdasarkan `Current.tenant_id`
(`api/app/models/concerns/tenant_scoped.rb:17-24`). Tapi **`Portfolio`, `PortfolioSkill`,
`FitGapReport`, dan `AssessorOverride` sama sekali tidak** (dikonfirmasi dengan membaca
seluruh isi `api/app/models/portfolio.rb`, `portfolio_skill.rb`, `fit_gap_report.rb`,
`assessor_override.rb` — tidak ada baris `include TenantScoped` di satupun). Ini konsisten
dengan skema: tabel `portfolios`, `portfolio_skills`, `fit_gap_reports` di
`db/schema.rb:85-131` **tidak punya kolom `tenant_id` sama sekali**.

Dampaknya konkret di controller — beberapa action melakukan lookup langsung by ID tanpa
melalui `Session` (yang terproteksi):
- `api/app/controllers/api/v1/portfolios_controller.rb:150-160` (`set_portfolio`) — untuk
  action `export`, jalur `@session` kosong sehingga jatuh ke
  `Portfolio.find(params[:id])` (baris 156) **tanpa filter tenant apa pun**.
- Baris 82 (`regenerate_fitgap`), baris 104 (`fitgap`), baris 130 (`show_fitgap`) — ketiganya
  `Portfolio.find(params[:id])` langsung.
- `api/app/controllers/api/v1/portfolio_skills_controller.rb:50-55` (`set_portfolio_skill`)
  — `PortfolioSkill.joins(:portfolio).find(params[:id])`, juga tanpa filter tenant.

Karena primary key semua tabel ini `bigint` auto-increment biasa (bukan UUID), ID bisa
ditebak/diurut. **Konsekuensi**: assessor tenant mana pun yang punya JWT valid (role
`admin`/`assessor`) bisa mengakses `GET /api/v1/portfolios/:id/export?format=pdf` untuk ID
portfolio milik tenant lain — mendapat PDF berisi kutipan langsung wawancara kandidat, level
kompetensi, dan evidence quotes milik organisasi lain. Endpoint `override` di
`portfolio_skills_controller.rb` bahkan memungkinkan **menulis** override rating ke skill
milik tenant lain. Ini pelanggaran UU PDP langsung (data pribadi kandidat — termasuk kutipan
ucapan mereka — bisa diakses lintas organisasi tanpa otorisasi) sekaligus merusak integritas
hasil penilaian (rating bisa ditimpa pihak yang tidak berwenang).

Sebagai pembanding, mekanisme resolusi tenant sendiri (`TenantResolverMiddleware`,
`api/app/middlewares/tenant_resolver_middleware.rb`) sebenarnya cukup hati-hati — scheme
tenant diprioritaskan dari klaim JWT yang sudah tervalidasi tanda tangannya di jalur auth
(`AuthorizeApiRequest`, `api/app/auth/authorize_api_request.rb`), bukan dari header yang bisa
dipalsukan bebas. Jadi celah ini **bukan** soal JWT bisa dipalsukan — murni karena empat model
di atas tidak pernah dipasangi filter tenant sama sekali.

### 4.2 Validasi input endpoint publik (invite link kandidat)

- `GET /sessions/:token/candidate` dan `POST /sessions/:token/audio_complete`
  (`api/app/controllers/api/v1/sessions_controller.rb:118-154`) sengaja tanpa JWT
  (`skip_before_action :require_tenant!`, route di `config/routes.rb:36-37`), pakai
  `Session.unscoped.find_by(invite_token: ...)` — token 256-bit acak jadi bearer capability
  yang wajar untuk pola ini.
- **Rate limiting ada**: `api/config/initializers/rack_attack.rb` — login dibatasi 5/menit/IP
  (baris 10-12), endpoint kandidat (`candidate`, `audio_complete`) dibatasi 30/menit/IP
  (baris 14-17). Ini secara eksplisit menjawab risiko brute-force token maupun spam.
- **Tapi `audio_complete` mempercayai klien sepenuhnya soal alasan sesi berakhir** —
  `api/app/controllers/api/v1/sessions_controller.rb:118-129`, komentar baris 124-126 secara
  eksplisit bilang "No coverage re-check here" (fix untuk bug race-condition sebelumnya).
  Konsekuensinya: siapa pun yang pegang invite token bisa memanggil endpoint ini kapan saja
  dan sesi akan langsung ditutup dengan `reason: 'all_covered'` — memicu portfolio generation
  dari transcript yang mungkin sangat pendek/kosong. Dampaknya terbatas ke sesi milik token
  itu sendiri (tidak bocor ke sesi lain), tapi tetap ini adalah endpoint publik yang
  mempercayai input klien untuk keputusan yang seharusnya diverifikasi server.

### 4.3 Transcript/audio kandidat di log aplikasi

- Tidak ditemukan log yang menulis **full transcript** atau **full prompt** ke LLM (`grep`
  logger call yang menyertakan variabel teks kandidat penuh — nihil).
- **Tapi** ditemukan cuplikan (bukan penuh): `api/app/clients/gemini/live_client.rb:287-297`
  (`log_gemini_event`) — memotong transkrip input/output ke 50 karakter
  (`input_tx_text.truncate(50)`, baris 288 dan 292) lalu menulisnya ke `Rails.logger.info`
  (baris 297) — jadi **setiap turn** percakapan (kandidat maupun AI) meninggalkan cuplikan di
  application log level INFO, bukan DEBUG. Ini bukan kebocoran transcript penuh, tapi tetap
  data pribadi (potongan ucapan kandidat) masuk ke sistem log yang biasanya punya kebijakan
  akses/retensi lebih longgar daripada database utama.
- Tidak ditemukan `puts`/`p`/`pp` debug print yang tertinggal di kode produksi.

### 4.4 Secret / API key

- **Tidak ada API key atau secret ter-hardcode** di kode (`grep` pola API key Google/OpenAI-
  style dan pola `secret = "..."` — nihil di luar `ENV.fetch`).
- `config/application.yml` (file asli berisi secret) **benar di-gitignore**
  (`api/.gitignore:24`), dan `git ls-files`/`git log --diff-filter=A` mengonfirmasi hanya
  `config/application.yml.sample` (isinya placeholder) yang pernah di-commit.
- `config/initializers/gemini.rb` memvalidasi env var wajib ada saat boot di production
  (`raise` kalau `GEMINI_API_KEY` dkk kosong) — praktik yang baik, gagal cepat bukan diam-diam.

### 4.5 Retensi & penghapusan data kandidat

**Tidak ada mekanisme apa pun.** `grep` menyeluruh untuk `retention`, `purge`, `gdpr`, `pdp`,
`anonymiz`, `data_deletion` di seluruh `app/`, `config/`, `db/` — nihil. Tidak ada scheduled
job pembersihan data, tidak ada endpoint admin untuk menghapus data kandidat, tidak ada kolom
`deleted_at`/`expires_at` di skema (§3). Transcript penuh, audio-derived text, dan portfolio
(termasuk kutipan langsung ucapan kandidat) tersimpan **permanen** sejak sesi selesai. Untuk
produk yang tunduk UU PDP dan memproses data kandidat yang tidak bisa opt-out dari
penilaiannya sendiri, ketiadaan jalur retensi/penghapusan ini adalah gap kepatuhan yang nyata,
bukan cuma risiko teoretis.

### 4.6 Consent kandidat

Sebelum mikrofon diaktifkan, kandidat hanya melihat teks informasional ("This is a voice
interview... Your mic will be active throughout...",
`web/src/pages/interview/InterviewPage.tsx:203-211`) plus dialog izin mikrofon native
browser. Tidak ada artefak consent eksplisit ("saya setuju direkam dan dinilai AI") yang
tercatat di sistem. Ini bukan bug teknis, tapi relevan mengingat kandidat adalah pihak yang
dinilai dan tidak memilih produk ini.

### 4.7 Hal-hal yang sudah baik (agar audit tidak timpang sebelah)

- Validasi input konsisten di level model (presence, inclusion, numericality) di semua 14
  model.
- CORS **tidak** hardcode wildcard di kode (`ALLOWED_ORIGINS` dari env,
  `api/config/initializers/cors.rb:5`) — meski file `.sample` mencontohkan `"*"`
  (`config/application.yml.sample:27`), yang berisiko kalau di-copy apa adanya ke production
  tanpa diganti.
- Semua controller assessor gated lewat `authorize_auth_token! :assessor` yang benar
  memverifikasi tanda tangan JWT (`JsonWebToken.decode` dengan `verify: true`,
  `api/app/lib/json_web_token.rb:17-19`) — bukan cuma decode tanpa cek.
- JWT di frontend disimpan di `localStorage` (`web/src/stores/authAtom.ts:9-15`) — pola umum
  SPA, tapi lebih rentan XSS-exfiltration dibanding httpOnly cookie; tidak ada indikasi ini
  keputusan sadar yang didokumentasikan.

---

## 5. Status Testing & CI

Klaim brief **dikonfirmasi benar**, dengan satu nuansa penting:

- **`api/`**: nol file di `spec/` (direktori itu bahkan tidak ada — dikonfirmasi `find`).
  **Tapi** infrastrukturnya sudah disiapkan dan tidak dipakai:
  `api/.rspec` (file config RSpec) ada dan ter-commit, dan `Gemfile:46-63` sudah mencantumkan
  `rspec-rails`, `factory_bot_rails`, `faker`, `database_cleaner`, `timecop`,
  `rubocop-rspec`. Artinya seseorang **berniat** memakai RSpec (gem sudah dipasang) tapi
  belum pernah benar-benar menulis satu spec pun.
- **`web/`**: nol test runner. `package.json:6-10` — script hanya `dev`/`build`/`preview`,
  tidak ada `test`. `devDependencies` tidak mengandung Vitest/Jest/`@testing-library/*` sama
  sekali. Tidak ada `vitest.config.ts` atau file config test lain.
- **CI**: tidak ditemukan di mana pun dalam repo — tidak ada `.github/workflows`, tidak ada
  `.circleci`, tidak ada file YAML lain yang berbentuk pipeline (yang ada di root hanya
  `api/config/database.yml`, `api/config/sidekiq.yml`, dan manifest Kubernetes di
  `api/k8s/*.yaml` — itu config deployment, bukan CI).

**Implikasi:** seluruh logika inti yang cukup rumit — hard rule `probe_count >= 2` di
`StateEngine`, isolasi tenant (yang justru terbukti bolong di §4.1), timing coverage
injection — berjalan tanpa jaring pengaman regresi sama sekali. Perubahan apa pun ke area ini
ke depannya (termasuk revamp yang akan dikerjakan) tidak akan otomatis ketahuan kalau
merusak salah satu aturan keras tersebut.

---

## 6. Tabel Severity Findings (P0–P3)

Definisi severity mengikuti brief: **P0** = merusak kepercayaan hasil penilaian kandidat atau
kebocoran data pribadi (UU PDP); **P1** = fitur inti PRD tidak berfungsi/tidak ada,
berdampak langsung ke keputusan hiring; **P2** = berfungsi tapi kualitas/UX buruk, berdampak
efisiensi assessor; **P3** = kosmetik.

| ID | Area | Severity | Kategori | Impact | Evidence |
|---|---|---|---|---|---|
| F-01 | api | **P0** | defective implementation | Assessor tenant mana pun (dengan JWT valid organisasinya sendiri) bisa membaca **dan menulis** portfolio, override rating, dan fit/gap report milik kandidat di tenant lain lewat ID numerik langsung — kebocoran data pribadi lintas organisasi + integritas hasil penilaian bisa ditimpa pihak tak berwenang. | `api/app/models/portfolio.rb`, `portfolio_skill.rb`, `fit_gap_report.rb`, `assessor_override.rb` (tidak ada `include TenantScoped`); `api/app/controllers/api/v1/portfolios_controller.rb:82,104,130,156`; `portfolio_skills_controller.rb:50-55`; `db/schema.rb:85-131` (tidak ada kolom `tenant_id`) |
| F-02 | api | **P0** | missing spec (UU PDP) | Tidak ada jalur retensi/penghapusan data kandidat sama sekali — transcript, kutipan ucapan, dan portfolio tersimpan permanen tanpa batas waktu atau mekanisme hapus. Gap kepatuhan UU PDP langsung untuk pihak yang tidak bisa opt-out dari penilaiannya. | `grep` menyeluruh `retention/purge/gdpr/pdp/anonymiz` di `app/`,`config/`,`db/` = nihil hasil; tidak ada kolom `deleted_at`/`expires_at` di `db/schema.rb` |
| F-03 | api | **P1** (berpotensi P0 jika sanitizer gagal) | defective implementation | Coverage map/time-control "hidden signal" (B6) dikirim lewat `realtimeInput.text`, bukan `clientContent` sesuai spek PRD — terbukti bocor ke transkrip ucapan AI (ditambal regex 8-pola, bukan diperbaiki di akar). Kandidat berpotensi mendengar/melihat fragmen kriteria penilaian internal, mengancam validitas asesmen. | `api/app/clients/gemini/live_client.rb:92-97`; `api/app/channels/audio_websocket_middleware.rb:271-283` (komentar baris 271 mengakui kebocoran) |
| F-04 | api | **P1** | defective implementation | Confidence level di portfolio (N10) 100% hasil self-report LLM, tidak diverifikasi ulang terhadap `probe_count` aktual di database — beda perlakuan dengan coverage state (N7) yang aturan kerasnya ditegakkan dua kali di kode. Assessor bisa diberi sinyal "high confidence" yang sebenarnya tidak memenuhi kriteria PRD, langsung memengaruhi keputusan hiring. | `api/app/services/portfolios/generator.rb:150-179` (tidak ada cross-check ke `coverage_map.probe_count`); bandingkan `api/app/services/coverage/state_engine.rb:17-26` |
| F-05 | api | **P1** | defective implementation | Narasi budaya kerja fit/gap (N13) tidak menerima `competency_summary` per-skill sebagai input LLM seperti diminta PRD — hanya angka level/delta. Variabel `portfolio_session`/`assessment` dihitung tapi tidak dipakai (bukti integrasi belum selesai). Narasi yang dihasilkan lebih dangkal dari spek, langsung dipakai assessor untuk keputusan hiring. | `api/app/services/fit_gap/engine.rb:111-139` (khususnya baris 113-114 unused vars) |
| F-06 | api | **P1** | defective implementation | `AudioRingBuffer` — class lengkap untuk replay audio saat reconnect — tidak dipanggil dari mana pun di codebase. Klaim di komentar ("audio buffered … and replayed") tidak benar; audio kandidat yang terucap tepat saat gap reconnect Gemini kemungkinan hilang, bukan di-replay. | `api/app/lib/audio_ring_buffer.rb` (definisi, 65 baris); `grep -rn "AudioRingBuffer"` hanya match file itu sendiri; klaim di `api/app/channels/audio_websocket_middleware.rb` sekitar `handle_gemini_close` |
| F-07 | api | **P1** | missing spec | Nol RSpec spec meski `rspec-rails`/`factory_bot_rails`/`database_cleaner`/`timecop` sudah ada di `Gemfile` dan `.rspec` sudah ter-commit. Tidak ada jaring pengaman regresi untuk logika inti (termasuk aturan keras `probe_count>=2` dan celah tenant di F-01) — perubahan apa pun ke depan bisa diam-diam merusaknya. | `api/Gemfile:46-63`; `find api -iname "*spec*"` → hanya `.rspec`, tidak ada direktori `spec/` |
| F-08 | web | **P1** | missing spec | Nol test runner sama sekali di frontend (tidak ada Vitest/Jest, tidak ada script `test` di `package.json`). Logika WS reconnect, state machine interview, dan audio pipeline — semuanya tanpa test otomatis. | `web/package.json:6-10,40-49` |
| F-09 | both | **P1** | missing spec | Tidak ada CI pipeline sama sekali di repo (tidak ada `.github/workflows`, `.circleci`, atau setara) — F-07 dan F-08 di atas bahkan tidak dijalankan otomatis kalau pun specnya ditulis nanti. | `find . -iname "*.yml" -o -iname "*.yaml"` di seluruh repo → hanya config deployment (`database.yml`, `sidekiq.yml`, `k8s/*.yaml`), nihil workflow CI |
| F-10 | api | **P2** | defective implementation | Cuplikan transkrip kandidat/AI (≤50 karakter per turn) tertulis ke application log level INFO pada setiap turn percakapan — bukan transcript penuh, tapi tetap data pribadi masuk ke sistem log yang biasanya punya kontrol akses/retensi lebih longgar dari database utama. | `api/app/clients/gemini/live_client.rb:287-297` |
| F-11 | api | **P2** | defective implementation | Endpoint publik `audio_complete` mempercayai penuh input klien untuk menutup sesi dengan alasan `all_covered` tanpa verifikasi ulang coverage di server (didokumentasikan sebagai trade-off sengaja di komentar kode). Siapa pun pemegang invite token bisa memicu penutupan sesi prematur, menghasilkan portfolio dari transcript sangat pendek. Dampak terbatas ke sesi itu sendiri. | `api/app/controllers/api/v1/sessions_controller.rb:118-129` (komentar baris 124-126) |
| F-12 | web | **P2** | missing spec | Tidak ada artefak consent eksplisit sebelum mikrofon dibuka dan data suara diproses AI — hanya teks informasional + dialog izin browser. Relevan karena kandidat tidak bisa opt-out dari sistem penilaian yang menilai mereka. | `web/src/pages/interview/InterviewPage.tsx:203-211` |
| F-13 | api | **P3** | defective implementation (operasional) | `config/application.yml.sample` mencontohkan `ALLOWED_ORIGINS: "*"` — bukan bug di kode (kode sudah env-driven), tapi risiko kalau file sample disalin apa adanya ke production. | `api/config/application.yml.sample:27` |
| F-14 | web | **P3** | defective implementation | Token JWT disimpan di `localStorage`, bukan httpOnly cookie — pola umum SPA tapi lebih rentan eksfiltrasi lewat XSS; tidak ada indikasi ini keputusan yang didokumentasikan sadar. | `web/src/stores/authAtom.ts:9-15` |

---

## 7. Opsi Scoping Revamp

Lima opsi di bawah disusun netral, **tanpa rekomendasi final** — masing-masing menyentuh
minimal satu temuan P0/P1, bisa dikerjakan full-stack (dengan catatan porsi
backend/frontend/test berbeda-beda per opsi, dijelaskan di masing-masing), dan realistis
untuk ~36 jam dengan latar belakang Rails/Sidekiq yang masih baru. Efisiensi waktu Anda akan
sangat dipengaruhi seberapa cepat Anda familiar dengan konvensi Rails (migration, service
object, Sidekiq) — bukan cuma kompleksitas kodenya.

### Opsi A — Tutup celah isolasi tenant (F-01) + bukti lewat test
- **Scope**: Tambah kolom `tenant_id` (via migration, backfill dari `session.tenant_id`) +
  `include TenantScoped` ke `Portfolio`, `PortfolioSkill`, `FitGapReport`,
  `AssessorOverride`; perbaiki lookup di `portfolios_controller.rb` dan
  `portfolio_skills_controller.rb` supaya selalu lewat scope yang benar; tulis RSpec request
  spec yang membuktikan akses lintas-tenant sekarang ditolak (404/403).
- **Effort**: **M**. Perubahan kode sendiri mekanis, tapi bootstrap RSpec dari nol
  (`rails_helper.rb`, koneksi test DB, factory pertama) menambah waktu signifikan untuk yang
  belum pernah setup RSpec di Rails.
- **Risiko**: Sedang. Migration menyentuh tabel yang datanya bisa sudah ada (perlu backfill
  yang benar, bukan cuma `null: false` langsung); harus hati-hati tidak mematahkan asumsi
  sistem eksternal (rakamin-api) yang berbagi database.
- **Menyentuh**: F-01 (P0), sekaligus mencicil F-07 (test infra).

### Opsi B — Perbaiki channel B6 (F-03) + test untuk state engine
- **Scope**: Ganti `inject_context` dari `realtimeInput.text` ke `clientContent` (role user)
  sesuai spek PRD; verifikasi manual di browser (leak regex tidak lagi kepakai/lebih jarang
  kepakai); tulis RSpec unit test untuk `Coverage::StateEngine` dan `Coverage::Analyzer`
  (murni logika Ruby, tidak butuh DB/WebSocket, murah untuk ditulis) yang membuktikan aturan
  `probe_count >= 2` tahan terhadap output LLM yang "curang".
- **Effort**: **M**. Perubahan kode inti kecil (beberapa baris di `live_client.rb`), tapi
  **verifikasi perilakunya butuh Gemini API key asli + tes suara langsung di browser** —
  bagian ini yang paling memakan waktu dan sulit diprediksi.
- **Risiko**: Sedang-Tinggi. Perilaku real-time audio API sulit diverifikasi cepat; regresi
  gampang tidak ketahuan tanpa banyak percobaan manual. Bagian unit test `StateEngine`
  sendiri risikonya rendah.
- **Menyentuh**: F-03 (P1, berpotensi P0), mencicil F-07.

### Opsi C — Perbaiki integritas output AI (F-04 + F-05)
- **Scope**: Tambah langkah verifikasi/clamp confidence di
  `Portfolios::Generator#save_skills` berbasis `probe_count` aktual (meniru pola
  `StateEngine` yang sudah ada untuk N7); sambungkan `competency_summary` ke
  `FitGap::Engine#build_narrative_prompt`. Tulis unit test untuk kedua perbaikan (bisa
  stub `gemini_client`, tidak perlu panggilan LLM asli).
- **Effort**: **S/M**. Perubahan terlokalisir di 2 service object yang sudah ada, tidak
  menyentuh migration/routes. **Catatan jujur soal "full-stack"**: opsi ini dominan backend
  — sisi frontend sudah bisa menampilkan field yang diperbaiki tanpa perubahan UI baru;
  porsi "frontend" di opsi ini adalah verifikasi visual bahwa data yang benar tampil di
  `PortfolioPage`/`FitGapReportPage` yang sudah ada, bukan membangun UI baru.
- **Risiko**: Rendah-Sedang. Logika self-contained, mudah diuji tanpa infrastruktur real-time.
- **Menyentuh**: F-04 dan F-05 (keduanya P1) — dua temuan sekaligus dengan effort kecil.

### Opsi D — Bangun fondasi testing & CI (F-07 + F-08 + F-09)
- **Scope**: Setup RSpec penuh (`rails_helper.rb`, DatabaseCleaner, factory untuk model
  inti), tulis spec berprioritas tinggi (StateEngine, tenant scoping — bisa dobel fungsi
  sebagai bukti fix Opsi A kalau dikombinasi); setup Vitest di `web/` + beberapa smoke test
  untuk hook kritis; tambah 1 GitHub Actions workflow yang menjalankan kedua suite saat push.
- **Effort**: **L**. Opsi paling luas — tiga toolchain baru sekaligus (konvensi testing
  Rails, testing JS, YAML CI) untuk yang baru pertama kali pegang RSpec berisiko menghabiskan
  banyak dari 36 jam di setup/debug environment saja, bukan di logika.
- **Risiko**: Sedang. Risikonya lebih ke arah waktu (debugging environment/dependency) daripada
  kompleksitas logika.
- **Menyentuh**: F-07, F-08, F-09 (semua P1) langsung — dan secara tidak langsung
  memperkuat kredibilitas perbaikan apa pun yang dipilih di opsi lain kalau sempat
  dikombinasikan (kombinasi penuh dalam 36 jam kemungkinan besar tidak akan muat kalau
  dikerjakan tuntas semua).

### Opsi E — Perbaikan sempit lintas beberapa temuan (breadth-first)
- **Scope**: (a) Tenant-scope 4 model di F-01 dengan verifikasi manual (tanpa investasi RSpec
  penuh) sebagai mitigasi cepat; (b) tambah mekanisme retensi dasar untuk F-02 — misal Sidekiq
  scheduled job/rake task yang menghapus transcript & sesi lebih tua dari N hari, plus satu
  tombol "Delete candidate data" di halaman assessor (menggunakan pola `AlertDialog` yang
  sudah ada di frontend) — ini genuinely full-stack (worker + route + controller + tombol UI);
  (c) tambah re-check server-side ringan di `audio_complete` (F-11).
- **Effort**: **L** (tersebar di 3 perbaikan berbeda).
- **Risiko**: Sedang-Tinggi. Context-switching antar 3 area berbeda dalam 36 jam sebagai
  orang baru di Rails meningkatkan risiko tidak ada satu pun yang benar-benar tuntas/rapi
  dibanding fokus ke satu-dua opsi saja.
- **Menyentuh**: F-01 (P0, mitigasi cepat bukan fix penuh), F-02 (P0, sebagian —
  retensi ke depan, bukan penghapusan retroaktif), F-11 (P2).

---

*Audit ini murni eksplorasi & analisis — tidak ada kode perbaikan yang ditulis di sesi ini.*
