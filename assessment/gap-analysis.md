# Gap Analysis — Severity P0–P3

Sumber: audit kode `api/` (Rails) dan `web/` (React), dicocokkan sama spec produk
di wiki (PRD-01 "First Principles", PRD-02 "Real Simulation" — lihat
[product-context.md](product-context.md)). Tiap temuan ditandain:

- **Service**: `api` / `web` / `keduanya` (kalau gap-nya di seam data-ke-tampilan)
- **Jenis**: `missing spec` (emang belum pernah didefinisiin) atau `defective
  implementation` (udah didefinisiin, tapi rusak)
- **Dampak**: satu baris, ngejelasin ini nyakitin workflow user/candidate gimana

---

## P0 — Bahaya langsung ke kandidat atau kebocoran/tampering data lintas tenant

### P0-1: IDOR lintas tenant — baca laporan kandidat tenant lain
- **Service**: api — **Jenis**: defective implementation
- **Lokasi**: `api/app/controllers/api/v1/portfolios_controller.rb:62,82,104,130` (`export`, `fitgap`, `regenerate_fitgap`, `show_fitgap` pakai `Portfolio.find(params[:id])` tanpa scoping tenant)
- **Dampak**: Assessor tenant A yang login sah bisa nge-export PDF/JSON portfolio kandidat tenant B — bocorin nama, transcript quote, dan skor kandidat ke perusahaan yang gak berhak liat. Ini pelanggaran UU PDP, bukan cuma bug.
- Kenapa kejadian: `Portfolio`, `PortfolioSkill`, `AssessorOverride`, `CoverageMap`, `TranscriptTurn`, `FitGapReport` gak punya kolom `tenant_id` sama sekali dan gak ikut concern `TenantScoped` — mereka ngandelin selalu diakses lewat parent (`Session`/`Vacancy`) yang udah di-scope. Di 4 action ini, rantai itu putus.

### P0-2: IDOR lintas tenant — timpa skor kandidat tenant lain
- **Service**: api — **Jenis**: defective implementation
- **Lokasi**: `api/app/controllers/api/v1/portfolio_skills_controller.rb:50-55` (`set_portfolio_skill` pakai `PortfolioSkill.joins(:portfolio).find(params[:id])` tanpa filter tenant)
- **Dampak**: Assessor tenant mana pun bisa panggil `POST /portfolio_skills/:id/override` dan nimpa `override_level` kandidat tenant lain — ini bukan cuma bocor baca, ini **korupsi hasil assessment kandidat beneran**, dan proses hiring tenant lain bisa keputusan berdasar data yang udah dirusak orang luar.

### P0-3: Kegagalan koneksi/session interview disamarkan jadi "Interview Complete ✅"
- **Service**: web — **Jenis**: missing spec (gak ada state error sama sekali di tipe data) + defective implementation (catch block salah nge-route)
- **Lokasi**: `web/src/pages/interview/InterviewPage.tsx:43-52` (fetch info kandidat gagal → langsung `setInterviewState("complete")`); `web/src/hooks/useAudioWebSocket.ts:105-107` (error non-recoverable dari server → `onStateChange("complete")`); `useAudioWebSocket.ts:122-131` (reconnect abis 3x gagal → `"complete"` juga). `InterviewState` union di `web/src/types/index.ts:177-185` **gak punya state `"error"` sama sekali**.
- **Dampak**: Kandidat yang link-nya expired, koneksinya putus permanen, atau backend lagi down, ditampilin pesan "Interview Complete — terima kasih, tim hiring akan follow up," padahal gak ada satu jawaban pun yang kerekam. Kandidat gak bakal tau ada yang salah, gak retry, gak hubungin siapa-siapa — kesempatan kerjanya ilang diam-diam karena bug, bukan karena performanya.

### P0-4: Skill yang gak sempet diprobe hilang gitu aja dari laporan Portfolio, atau malah dinilai lowest-score
- **Service**: keduanya — **Jenis**: missing spec (PRD gak pernah nentuin apa yang muncul di laporan akhir buat skill yang gak sempet ke-cover) + defective implementation di kedua sisi
- **Lokasi backend**: `api/app/services/portfolios/generator.rb:161,173` — `skill_data['level'].to_i.clamp(1,5)`. Kalau Gemini return skill tanpa key `level` (misal karena interview keburu abis waktu), `nil.to_i` → `0` → `.clamp(1,5)` → **jadi skor 1 (level terendah)**, bukan ditandain "belum dinilai".
- **Lokasi frontend**: `web/src/pages/portfolio/PortfolioPage.tsx:190-202` cuma nge-render `portfolio.skills` apa adanya dari backend, **gak dicocokin ke daftar skill yang aslinya dikonfigurasi assessor** (`AssessmentSkill[]`). Konsep coverage state `"not_yet"` yang ada pas live monitoring (`LiveMonitorPage`, lihat `types/index.ts:55`) **gak pernah dibawa ke laporan final**.
- **Dampak**: Kandidat yang sesinya kepotong (habis waktu, di-end manual, error) bisa keliatan skor rendah di skill yang **sebenarnya gak pernah ditanyain**, dan assessor gak dikasih tau bedanya "emang jelek" vs "gak sempet dites" — ini persis skenario silent-zero yang brief minta dicek eksplisit.

### P0-5: Hardware check bisa nolak kandidat yang internetnya sebenarnya baik-baik aja
- **Service**: web — **Jenis**: defective implementation
- **Lokasi**: `web/src/utils/internetSpeedTest.ts` — test ping/download/upload default ke endpoint pihak ketiga (Google favicon, jsdelivr, unpkg, dan `httpbin.org`/`postman-echo.com` buat upload test, `measureUploadSpeed:90-92`). Kalau ketiganya keblokir (firewall korporat, `httpbin.org` lagi down — sering kejadian), fallback-nya hardcoded **0.5 Mbps** (line 105), padahal threshold minimum `DEFAULT_THRESHOLDS.minUploadMbps = 4` (line 19-23).
- **Dampak**: Kandidat diblokir total gak bisa mulai interview, murni gara-gara infrastruktur pihak ketiga yang gak ada hubungannya sama koneksi kandidat beneran. `retryAll()` cuma ngulang test yang emang bakal gagal lagi — kandidat kejebak.

### P0-6: "Copy link" ngehasilin invite link yang gak bisa dibuka kandidat sama sekali
- **Service**: api — **Jenis**: defective implementation
- **Lokasi**: `api/app/models/session.rb:40-41` (sebelum fix) — `invite_url` bikin link pake `APP_BASE_URL`, yang didokumentasiin eksplisit di `api/README.md:30` dan `application.yml.sample:21` sebagai **"Backend base URL"** (default `http://localhost:3001`). Tapi `/interview/:token` itu route **frontend** (React Router/Vite), bukan route backend.
- **Dampak**: Di environment manapun frontend & backend beda origin (yang emang normal buat arsitektur two-service ini), tombol "Copy link" yang dipake assessor buat ngundang kandidat ngehasilin URL yang nunjuk ke server API, bukan ke halaman interview. Kandidat yang buka link itu cuma dapet Rails routing error. Ini nutup **happy path paling dasar** — kandidat gak bisa mulai interview sama sekali lewat jalur utama, ditemuin pas manual testing "Copy link" beneran di browser.
- **Status**: [x] **RESOLVED** (di-route ke `FRONTEND_BASE_URL` port 5173).

- **Service**: api & web — **Jenis**: defective implementation / model deprecation & rate limiting
- **Lokasi**: `api/app/clients/gemini/live_client.rb` & `api/app/clients/gemini/http_client.rb` — Hardcoded string model `gemini-2.0-flash-exp` pensiun di server Google sehingga live voice interview WebSocket gagal handshake (404/400). Selain itu, panggilan HTTP tanpa exponential backoff retry mudah terbentur 429 Rate Limit.
- **Dampak**: Kandidat yang mulai wawancara suara live tidak dapat terhubung ke AI sama sekali (WebSocket connection aborted), dan proses generate evaluasi portfolio gagal di background jika terkena rate limit kuota API.
- **Status**: [x] **RESOLVED** (dimigrasikan ke endpoint produksi resmi `gemini-3.1-flash-live-preview` untuk live audio WebSocket dan `gemini-3.5-flash` pada `https://generativelanguage.googleapis.com/v1beta` untuk evaluasi HTTP, dilengkapi arsitektur 429 exponential backoff retry dan multi-model fallback `gemini-2.5-flash`/`gemini-1.5-flash`).

### P0-8: Fit/Gap Engine Infinite Loading & Silent Failure pada Lowongan Tanpa Skill
- **Service**: api — **Jenis**: defective implementation / missing validation
- **Lokasi**: `api/app/models/fit_gap_report.rb:7` & `api/app/services/fit_gap/engine.rb` — `validates :skill_comparisons, presence: true` menganggap array kosong `[]` sebagai invalid/blank saat membandingkan lowongan kosong. Akibatnya background worker gagal diam-diam dan browser terus melakukan polling tanpa henti (*infinite loading spinner*).
- **Dampak**: Assessor yang memilih benchmark lowongan kosong mengalami halaman stuck loading "Generating fit/gap report..." selamanya.
- **Status**: [x] **RESOLVED** (ditambahkan `allow_blank: true` pada validasi model `FitGapReport`, fallback anggun di `FitGap::Engine`, dan validasi wajib minimal 1 skill di frontend `VacancyNewPage`).

---

## P1 — Rusak signifikan, belum sampai bocor data tapi bisa hilangin hasil kerja atau salah gambarin kandidat

### P1-1: Regenerasi portfolio yang gagal bisa nge-hapus skor kandidat yang udah jadi
- **Service**: api — **Jenis**: defective implementation
- **Lokasi**: `api/app/services/portfolios/generator.rb:150-179` — `portfolio.portfolio_skills.destroy_all` (line 154) dipanggil **sebelum** create ulang, **tanpa transaction**. Kalau salah satu `create!` gagal (misal Gemini return `confidence` yang gak valid, kena validasi model), skor lama yang udah `complete` udah kehapus duluan, dan gak ada yang gantiin.
- **Dampak**: Skor kandidat yang sebelumnya udah jadi bisa hilang permanen gara-gara satu kegagalan regenerasi, tanpa ada mekanisme rollback.

### P1-2: Mic ke-deny/gagal tapi interview tetep jalan kelihatannya normal
- **Service**: web — **Jenis**: defective implementation
- **Lokasi**: `web/src/hooks/useAudioCapture.ts:8,43-47` (`onError` cuma `console.error` kalau gak dikasih callback); `web/src/pages/interview/InterviewPage.tsx:143-145` manggil `useAudioCapture({ onFrame: send })` **tanpa** pass `onError`, dan `startInterview()` (line 162-171) gak ngecek hasil capture-nya.
- **Dampak**: Kandidat yang mic-nya ke-revoke pas mau mulai (izin dicabut di address bar setelah lolos hardware check) bakal liat UI interview jalan normal (voice bar, timer) tapi **gak ada audio yang kekirim sama sekali** — interview-nya kosong, gak ada pesan error apapun yang kasih tau kandidat buat cek mic-nya.

### P1-3: Satu skill dengan data rusak bisa nge-crash seluruh halaman portfolio assessor
- **Service**: web — **Jenis**: defective implementation
- **Lokasi**: `web/src/utils/constants.ts:3-8` (`parseLevel`) — kalau `ai_level` `null`/`undefined`, `level.replace(...)` throw `TypeError`. `ErrorBoundary` cuma ada di root app (`main.tsx:9-15`), gak per-halaman/per-card.
- **Dampak**: Satu skill dengan data cacat bikin **seluruh** halaman hasil assessment nge-crash ke layar "Something went wrong" — assessor gak bisa liat skill-skill lain yang datanya baik-baik aja.

### P1-4: Token undangan interview gak pernah kedaluwarsa
- **Service**: api — **Jenis**: missing spec
- **Lokasi**: `api/app/models/session.rb:14,36` — `invite_token` cuma dibatesin rate-limit (`rack_attack.rb:15-17`), gak ada TTL.
- **Dampak**: Link interview yang ke-forward/bocor (screenshot, forward email) bisa dipake buat mulai/lanjut sesi kandidat **selamanya**, kapan pun, sampe sesi di-end manual.

### P1-5: JWT gak pernah dicek ulang ke status user asli
- **Service**: api — **Jenis**: defective implementation
- **Lokasi**: `api/app/auth/authorize_api_request.rb:8` — gak ada query DB sama sekali buat verifikasi user; gak ada revocation list; expiry default 3 hari (`api/app/lib/json_web_token.rb:10`).
- **Dampak**: Admin/assessor yang akun-nya udah dinonaktifin tetep bisa akses penuh sampe token-nya kedaluwarsa 3 hari kemudian.

### P1-6: JWT dev bisa ke-bundle ke JS publik, dan bikin logout gak beneran logout
- **Service**: web — **Jenis**: missing spec (gak ada guardrail/warning built-in) + defective implementation (fallback-nya sendiri salah)
- **Lokasi**: `web/src/stores/authAtom.ts:9` — `getStoredToken()`: `localStorage.getItem(STORAGE_KEY) ?? import.meta.env.VITE_DEV_TOKEN ?? null`; `.env.example` root nyaranin isi JWT asli di situ.
- **Dampak**: 2 lapis:
  1. Kalau `VITE_DEV_TOKEN` ke-set pas deploy staging/demo (gampang kejadian gak sengaja), token JWT asli ke-bundle plaintext di JS yang bisa diakses siapapun yang buka halamannya.
  2. **Dikonfirmasi reproduce**: selama `VITE_DEV_TOKEN` keisi (kondisi normal di dev lokal), klik "Logout" gak beneran ngelogout. `clearToken()` ngapus `localStorage`, tapi `authAtom` cuma di-init sekali pas module load (`atom<AuthState>({ token: getStoredToken() })`) — refresh browser bikin module ke-load ulang, `getStoredToken()` jatuh ke fallback `VITE_DEV_TOKEN` (non-null), `ProtectedRoute` liat token ada → lolos → auto-login balik ke `/assessments`. Assessor yang ngerasa udah logout (misal di komputer bersama) sebenernya masih ke-auth.
- **Status**: [x] **RESOLVED**

### P1-7: Timer Sesi Live Desinkronisasi & Peringatan Waktu Habis Palsu
- **Service**: web — **Jenis**: defective implementation
- **Lokasi**: `web/src/components/interview/InterviewTimer.tsx` — Menghitung mundur durasi berdasarkan interval lokal klien dari saat komponen dimount, bukan menghitung selisih waktu riil terhadap timestamp `started_at` dari backend.
- **Dampak**: Jika koneksi kandidat terputus sebentar atau halaman direfresh, timer tereset dan memunculkan pop-up dialog waktu habis (*Time Expired*) sebelum durasi sebenarnya berakhir.
- **Status**: [x] **RESOLVED** (timer disinkronkan langsung terhadap `session.started_at` dan trigger auto-finish saat batas durasi tercapai).

### P1-8: Kebocoran Data Biner Audio & Ambiguitas Transkripsi ASR Multibahasa
- **Service**: api & web — **Jenis**: defective implementation / privacy leak & acoustic model ambiguity
- **Lokasi**: `api/app/channels/audio_websocket_middleware.rb`, `api/app/services/assessments/system_prompt_compiler.rb`, & `web/src/components/interview/TranscriptBubble.tsx`
- **Dampak**: 
  1. Potongan data biner audio dan sisa kurung kurawal JSON (`}\n]`) sempat mengotori transkrip sebelum model AI selesai memproses audio.
  2. Modul Speech-to-Text (ASR) Gemini sempat mengalami ambiguitas fonetik pada ucapan volume rendah/desis mic di awal sesi, secara keliru menebak audio Indonesia menjadi aksara asing (seperti Hangul Korea `마케팅...` atau Prancis `Donc, sa team...`).
- **Status**: [x] **RESOLVED** (sanitasi parsing payload pesan suara di middleware & komponen UI, serta penambahan instruksi penguncian bahasa *Language Pinning Directive* di `SystemPromptCompiler` yang memaksa ASR Gemini mengunci transkripsi ke Bahasa Indonesia & istilah teknis standar Latin).

---

## P2 — Ngerusak kualitas/trust tapi gak langsung nentuin nasib kandidat

- **P2-1** (api, defective impl): Isi transcript kandidat (ucapan asli) kelog di `Rails.logger.info` — `api/app/clients/gemini/live_client.rb:287-293`. Masalah UU PDP: data personal masuk log aplikasi.
- **P2-2** (api, defective impl): Gak ada `config/initializers/filter_parameter_logging.rb` — password/JWT di request login gak ke-redact dari log Rails.
- **P2-3** (web, defective impl): Pola `.catch(() => {})` yang nelen error diem-diem, berulang di banyak halaman — `AssessmentInvitePage.tsx:148`, `AssessmentEditPage.tsx:54`, `PortfolioPage.tsx:50`, `FitGapReportPage.tsx:55` (cuma `.finally`), `LiveMonitorPage.tsx:77-95` (gak ada `.catch` sama sekali). Dampak: assessor liat halaman kosong/rusak tanpa penjelasan apapun kenapa.
- **P2-4** (api, missing spec): `FitGapGeneratorWorker`/`SystemPromptGeneratorWorker` gak punya hook `sidekiq_retries_exhausted` (beda dari `PortfolioGeneratorWorker` yang udah bener). Job yang gagal abis retry mati diem-diem di dead set Sidekiq, status di sisi user tetep nyangkut "generating" selamanya.
- **P2-5** (web, missing spec): Gak ada `timeout` di instance Axios (`web/src/services/api.ts:9-12`) — request yang nge-hang nunggu tanpa batas, gak ada indikasi ke user.
- **P2-6** (web, defective impl): `zod` + `@hookform/resolvers` udah keinstall di `package.json` tapi **gak pernah dipake** — validasi form cuma andelin `{ required: true }` polos bawaan HTML. `LoginPage.tsx` gak punya validasi format email/panjang password inline, dan `CustomSkillForm.tsx` bahkan gak nampilin pesan error sama sekali pas field kosong.
- **P2-7** (keduanya, missing spec): Gak ada CI sama sekali (gak ada `.github/workflows` di kedua service), dan RSpec di `api/` **nol file spec** walau semua gem test (`rspec-rails`, `factory_bot_rails`, dst) udah lengkap di Gemfile — `bundle exec rspec` bakal langsung gagal hari ini. `web/` juga nol test runner (gak ada Vitest/Jest, gak ada `test` script).
- **P2-8** (web, missing spec): **UI/UX Craftsmanship & Visual Taste rendah (Monozukuri gap)** — Layar login (`LoginPage.tsx`) tampil sangat polos tanpa card container, background depth, icon input, show/hide password toggle, maupun demo credential hint. Layar portfolio dan interview juga minim visual feedback (tidak ada spider/radar chart perbandingan skill target vs actual, audio waveform dinamis, dan skeleton loading states). Hal ini menurunkan kepercayaan user dan melanggar evaluasi rubric UI/UX (bobot 50%).

---

## P3 — Kerapian/utang teknis, dampak tipis ke user tapi baik dibenahi

- **P3-1** (api): Kolom `transcript_turns.audio_start_ms`/`audio_end_ms` ada di schema & di-expose ke JSON API tapi **gak pernah diisi** — selalu `nil`.
- **P3-2** (web): `SignupPage.tsx` lengkap 107 baris tapi gak ke-daftar di router — dead code.
- **P3-3** (api): `db/seeds.rb:39-77` bikin SQL insert lewat interpolasi string, bukan parameterized — aman sekarang (constant doang) tapi pola berbahaya kalau kepake ke input user nanti.
- **P3-4** (web): `AssessmentEditPage.tsx` drop field `language` pas update — assessor gak bisa ganti bahasa interview setelah assessment dibuat, padahal ada di form New.
- **P3-5** (web): Zero responsive breakpoint yang disengaja di seluruh halaman (`grep sm:|md:|lg:` cuma nyantol di komponen UI primitif shadcn, bukan di halaman produk) — kebetulan gak patah berkat pola `max-w + mx-auto`, tapi gak ada desain responsif yang niat.

---

## Rekap: Missing Specification vs Defective Implementation

**Belum pernah didefinisiin (missing spec):**
- State "error" buat interview kandidat (P0-3)
- Apa yang harus muncul di laporan Portfolio buat skill yang gak sempet ke-cover (P0-4, sisi spec)
- Kebijakan retensi/hapus data transcript & audio-derived data (UU PDP — lihat [product-context.md](product-context.md))
- Masa berlaku invite token (P1-4)
- Terminal state buat job Sidekiq selain `PortfolioGeneratorWorker` (P2-4)
- Timeout di HTTP client frontend (P2-5)
- Test harness & CI di kedua service (P2-7)

**Udah didefinisiin, tapi rusak (defective implementation):**
- Pola `TenantScoped` udah ada dan kepake bener di `Assessment`/`Session`/`Vacancy`, tapi gak diterapin konsisten ke `Portfolio`/`PortfolioSkill` (P0-1, P0-2)
- Clamp `level` di backend portfolio generator niatnya defensif, tapi salah default ke skor terendah alih-alih "belum dinilai" (P0-4, sisi implementasi)
- Hardware check niatnya protect kualitas interview, malah jadi gerbang palsu gara-gara dependency pihak ketiga (P0-5)
- Error handling di `useAudioCapture`/`useAudioWebSocket` ada tapi salah kanal (masuk ke state "complete" bukan state error) (P0-3, P1-2)
- Zod/RHF resolver udah terpasang sebagai dependency tapi gak pernah dipakai (P2-6)
- `getStoredToken()` fallback ke `VITE_DEV_TOKEN` bikin logout gak beneran ngelogout selama env var itu keisi — dikonfirmasi reproduce (P1-6)
- `invite_url` salah pake env var — niatnya bikin link buat kandidat, kepake `APP_BASE_URL` yang emang didokumentasiin buat backend sendiri (P0-6)

---

## Constraint Signal — hal yang gue eskalasi ke Technical Lead kalau ini proyek beneran

1. **Zero test coverage + zero CI di atas pipeline realtime yang stateful** (`audio_websocket_middleware.rb` 800+ baris, banyak cabang timer/reconnect). Ini risiko struktural terbesar di codebase — regresi di transisi coverage-state, logic session-end, atau perhitungan skor bakal ke-ship tanpa kedeteksi. Butuh test harness dulu sebelum nambah fitur besar lain, bukan sesudahnya.
2. **Pola tenant-scoping via "parent chain" itu rapuh by design.** Model tanpa `tenant_id` (`Portfolio`, `PortfolioSkill`, dkk) ngandelin programmer inget buat selalu masuk lewat parent yang ke-scope — dan itu udah kebukti gagal dua kali (P0-1, P0-2). Perlu keputusan arsitektur: tambahin `tenant_id` ke semua tabel turunan, atau bikin lapisan authorization terpusat (misal Pundit policy) yang gak bisa dilewatin per-controller.
3. **Urutan verifikasi JWT ambigu**: `TenantResolverMiddleware` decode JWT tanpa verifikasi signature duluan (buat resolve tenant), verifikasi signature beneran baru kejadian belakangan di `AuthorizeApiRequest`. Ini "intentional" per komentar kode, tapi susunan begini gampang disalahpahami developer baru dan gampang jadi celah kalau ada yang refactor tanpa ngerti urutannya.
4. **Dependency pihak ketiga (httpbin.org, jsdelivr, unpkg) ada di jalur yang nge-block kandidat mulai interview.** Ini bukan cuma bug test-nya, ini keputusan produk yang naruh nasib kandidat di tangan uptime layanan yang gak dikontrol platform ini sama sekali.
5. **Frontend gak punya lapisan validasi terpusat** (Zod terpasang tapi nganggur) dan **gak ada error-handling terpusat** (tiap halaman re-implement pattern try/catch sendiri-sendiri, kualitasnya beda-beda). Ini bukan sekadar kerapian kode — inkonsistensi ini yang bikin sebagian besar temuan P0/P1/P2 di sisi web (silent catch, crash gak ke-isolate, state error yang gak ada) muncul di tempat yang beda-beda alih-alih satu tempat.
6. **Revocation buat role `assessor` masih bolong.** Fix P1-5 nutup revocation buat akun `admin` lokal (kolom `active` + cache 60 detik), tapi token `role: assessor` diterbitin app sister `rakamin-api` buat akun yang gak ada di tabel `users` app ini sama sekali — gak ada yang bisa dicek di sisi app ini. Nutup ini beneran butuh salah satu: app sister expose mekanisme revocation-nya sendiri (webhook/shared cache), atau app ini dikasih akses baca ke tabel user asli (`public.users`, mirip pola `Organization`). Keputusan lintas-tim, bukan sesuatu yang bisa diputusin sepihak dari sisi `ai-interview-platform`.

---

## Catatan Design Polish (di luar severity list)

Beberapa perbaikan visual (card layout/depth, show/hide password toggle di
login, skeleton loading, dll) sengaja **gak dimasukin ke daftar P0-P3 di
atas**. Severity list ini diukur dari "seberapa nyakitin ini ke workflow
user/kandidat" (persis kayak yang brief minta) — item-item visual itu
preferensi craft (Monozukuri), bukan defect yang ngerugiin siapapun kalau
gak dibenerin, jadi maksain kasih level P2/P3 cuma ngelemahin kredibilitas
severity list yang isinya beneran defect (IDOR, crash, misrepresent skor).

Kerjaan ini tetap dilakuin dan disubmit (kemungkinan sebagai PR terpisah
di luar 4 sub-PR P0, dibuka belakangan setelah ditest) — cuma dicatet di
sini sebagai polish, bukan gap severity, dan didokumentasiin ringan di
[revamp-strategy.md](revamp-strategy.md) tanpa AC/trade-off selengkap
sub-PR P0.
