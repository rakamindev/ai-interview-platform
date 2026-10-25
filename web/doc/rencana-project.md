# RENCANA PROYEK — AI INTERVIEW PLATFORM

> **Fungsi dokumen ini:** peta konteks proyek. Dibaca oleh siapa saja yang baru masuk
> (termasuk **new session AI / Claude**) agar langsung paham: apa yang dikerjakan, status
> per phase, keputusan teknis, cara menjalankan, konvensi, dan langkah berikutnya.
>
> Terakhir diperbarui: **17 Agu 2026 (Phase 4 — Bug Fixes & Resilience)**.
> Dokumen pelengkap rinci per item perubahan: `web/doc/ringkasan-phase-0.md`.

---

## 1. KONTEKS & TUJUAN

- **Project:** **AI Interview Platform** — wawancara kandidat via suara **real-time** dengan AI
  (Gemini Live API). Sistem menilai cakupan skill (coverage) per skill rubrik, menghasilkan
  **portfolio** kandidat, lalu membandingkannya dengan **vacancy** (fit-gap report).
- **Pemilik proyek:** user **pemula** di Ruby/Rails/Redis (belajar sambil mengerjakan case study).
- **Case study:** Fullstack Product Engineer — **Rakamin**.
- **Deadline demo:** **Rabu, 19 Agu 2026, 13:00 WIB**.
- **Tujuan utama:** demo yang **bisa dipertanggungjawabkan** — berjalan dengan baik DAN pemilik
  mampu menjelaskan setiap keputusan teknis (terutama bagian Ruby on Rails), karena itu tiap
  perubahan didokumentasikan dengan *alasan*.
- **Posisi sekarang:** Semua phase (0–4) selesai. K-01 s/d K-22 verified. Server
  (puma/sidekiq) dihentikan; user yang menjalankan manual. Siap untuk demo.

---

## 2. PRINSIP PENGERJAAN

1. **KISS (Keep It Simple)** — selesaikan yang paling penting untuk demo lebih dulu; hindari
   over-engineering; jangan menambah fitur sebelum inti stabil.
2. **Prioritas P0–P3** pada setiap item (definisi di bagian 3).
3. **User menjalankan & mengetes sendiri** di browser. AI **tidak** menjalankan/mematikan server
   (puma, sidekiq, vite). AI menulis kode, mengecek sintaks (`ruby -c`, `tsc --noEmit`), dan
   mengubah DB via `rails runner`.
4. **Ritme bertahap:** AI selesaikan satu batch → user tes di browser → konfirmasi → lanjut.
5. **Jangan pernah** membaca/menampilkan isi file `.env` atau `application.yml` yang berisi secret.
   Cukup pakai `.env.example` dan nama variabel (lihat konvensi di 6.7).
6. **Sumber kebenaran konteks:** dokumen ini + `web/doc/ringkasan-phase-0.md`.
   Detail review produk: `web/doc/analisa-gap-halaman-dan-fitur-rakamin-interview.md`.

---

## 3. DEFINISI PRIORITAS (P0–P3)

| Level | Arti | Contoh |
|---|---|---|
| **P0** | Blocker — tanpa ini demo tidak bisa jalan sama sekali | Server jalan, Gemini API valid, kandidat bisa join |
| **P1** | Kualitas inti — fitur utama yang dievaluasi | Interview stabil, coverage benar, login sungguhan |
| **P2** | Kenyamanan / kejelasan | Pesan error jujur, UX invite, live monitor |
| **P3** | Polesan / dokumentasi | Ringkasan per phase, bersih-bersih dead code |

---

## 4. RENCANA PER PHASE & STATUS

| Phase | Isi | Status |
|---|---|---|
| **Phase 0** | Fondasi & blocker: infra jalan, Gemini API valid, kandidat bisa join, E2E | ✅ Selesai |
| **Phase 1** | Inti interview: 3 masalah interview + coverage akurat + graceful exit | ✅ Selesai (terverifikasi sesi 6 & 8) |
| **Phase 2** | Login sungguhan, portfolio, fit-gap, monitor, UX polish | ✅ Selesai |
| **Phase 3** | Polesan & persiapan demo | ✅ Selesai |
| **Phase 4** | Bug fixes & resilience: auto-end, leak JSON, retry, speed test, rejoin, time warning | ✅ Selesai |

### Kasus uji per phase

**Phase 0 — Fondasi & Blocker (✅ selesai)**
- [x] **K-01** Infra jalan: puma :3001, vite :5173, sidekiq, Redis, PostgreSQL
- [x] **K-02** Gemini API valid (3 model: live / flash / pro)
- [x] **K-03** Kandidat lolos cek perangkat & koneksi + bisa buka link invite
- [x] **K-04** 1 sesi interview end-to-end sukses sampai portfolio

**Phase 1 — Inti Interview & Coverage (✅ selesai, terverifikasi sesi 6 & 8)**
- [x] **K-05** AI tidak memotong kandidat saat jeda (silence pump 1s → 2.5s) — *verified sesi 6 & 8*
- [x] **K-06** Tidak ada teks internal yang diucapkan AI (system prompt dirampingkan + regenerate DB) — *verified*
- [x] **K-07** Sesi berakhir dengan graceful exit; AI transparan alasan interview berakhir — *verified sesi 8*
- [x] **K-08** Coverage map per skill akurat (initiated → partial → covered) — *verified sesi 6 (2 skills → covered)*

**Phase 2 — Login, Portfolio, Fit-Gap, Penyempurnaan (✅ selesai)**
- [x] **K-09** Admin login sungguhan (seed admin + pesan error jujur + backdoor token ditutup)
- [x] **K-10** Portfolio hasil interview + override admin — *berfungsi, terverifikasi*
- [x] **K-11** Fit-gap portfolio vs vacancy — *berfungsi, field mismatch fixed (required_level → expected_level)*
- [x] **K-12** Live monitor + UX invite — *reconnect button, clipboard fallback, error states added*

**Phase 3 — Polesan & Persiapan Demo (✅ selesai)**
- [x] **K-13** Ringkasan per phase (bekal interview) — `web/doc/ringkasan-phase-0.md`
- [x] **K-14** Bersih-bersih dead code (SignupPage dihapus), error states, backend robustness

**Phase 4 — Bug Fixes & Resilience (✅ selesai)**
- [x] **K-15** Auto-end saat kandidat pamitan — Branch C fallback inject `WRAP_UP_SIGNAL`
- [x] **K-16** Transcript leak JSON — regex diperluas + safety check
- [x] **K-17** AI loop nudge kontradiktif — time-critical guard
- [x] **K-18** Retry button hard refresh — `window.location.reload()`
- [x] **K-19** Interview page retry on lost — tombol "Refresh Page"
- [x] **K-20** Self-host speed test — `/api/v1/speed-test` primary
- [x] **K-21** Rejoin option on bad internet — 8 reconnection attempts + state "failed"
- [x] **K-22** Time warning 10 menit — tier `:warn_600` + banner frontend

---

## 5. STATUS SAAT INI & LANGKAH BERIKUTNYA

### Sudah selesai (Phase 0–4)
1. Infra + **konfigurasi model Gemini** via `api/config/application.yml`
   (live = model flash-live preview, flash/pro = model flash terbaru — semua via env config).
2. Fix **koneksi kandidat** (internet/hardware check + invite link) — E2E interview sukses.
3. **3 masalah interview**:
   - Silence pump `1s → 2.5s` (`live_client.rb`) — kandidat tidak dipotong saat berpikir.
   - System prompt dirampingkan + **regenerate di DB** — teks internal tidak bocor diucapkan AI.
   - End-sesi hanya via backend (gated `coverage_pending` + `nudge_ai_to_continue`, maks 3×).
4. **Graceful exit** — AI transparan alasan interview berakhir, jawab pertanyaan kandidat dulu.
5. **Login sungguhan**: seed 3 role (hiring_manager/assessor/recruiter), pesan error jujur,
   backdoor `VITE_DEV_TOKEN` dihapus dari kode FE dan `.env`.
6. **UX polish**: password toggle, clipboard fallback, reconnect button, error states, assessment edit warning.
7. **Backend robustness**: TOCTOU race fix (`with_lock`), coverage retry, empty transcript guard.
8. **Dead code cleanup**: `SignupPage.tsx` dihapus.
9. **Bug fixes (Phase 4)**:
   - Auto-end saat kandidat pamitan — Branch C fallback inject `WRAP_UP_SIGNAL`.
   - Transcript leak JSON — regex diperluas + safety check.
   - AI loop nudge kontradiktif — time-critical guard (jangan nudge kalau `pacing: critical`).
   - Retry button hard refresh — `window.location.reload()`.
   - Self-host speed test — `/api/v1/speed-test` primary, httpbin fallback.
   - Rejoin option — 8 reconnection attempts, state "failed", tombol retry.
   - Time warning 10 menit — tier `:warn_600` backend + banner frontend.

### Siap untuk demo
- Start puma + sidekiq manual, buka `http://localhost:5173`.
- Login: `admin@test-corp.com` / `admin123` (atau assessor/recruiter).
- Jalankan sesi interview: AI tidak memotong, tidak bocor teks internal, graceful exit.
- Kandidat pamitan → AI langsung tutup (auto-end via Branch C).
- Transcript bersih (tidak ada leak JSON/metadata).
- Time warning muncul di 10 menit dan 5 menit sisa.
- Lihat portfolio + fit-gap report.
- Reconnect button tersedia di Live Monitor jika WS disconnect.
- Retry button + reconnect option tersedia jika koneksi terputus saat interview.

### Backlog / catatan
| Item | Catatan |
|---|---|
| Fitur lanjutan Tier (export, dashboard, dsb.) | Prioritas setelah demo inti stabil |
| Audio recording untuk assessors/HR | Phase berikutnya — simpan audio interview agar assessors bisa dengar ulasan kandidat |
| Git | Branch `fix/interview-revamp`, user commit sendiri |

---

## 6. PETA TEKNIS (ORIENTASI CEPAT)

### 6.1 Stack & port

| Komponen | Teknologi | Port / URL |
|---|---|---|
| Frontend | React 18 + Vite 5 + TypeScript + Tailwind + Jotai + Axios | `http://localhost:5173` |
| Backend API | Ruby on Rails (API-only, Puma cluster mode) | `http://localhost:3001` |
| Background jobs | Sidekiq (+ Redis) | via `sidekiq.yml` |
| Database | PostgreSQL | schema `public` utk org/auth; tenant schema utk data |
| AI | Gemini Live API (WebSocket) + generateContent (HTTP) | — |

> Catatan: `web/.env` berisi `VITE_API_BASE_URL=http://localhost:3001/api/v1` dan
> `VITE_WS_BASE_URL=ws://localhost:3001` (bukan default kode :3000).

### 6.2 Arsitektur alur request

```
Browser (Vite :5173)
   │  REST (Axios) + WebSocket (audio)
   ▼
Rails API (Puma :3001)
   ├── PostgreSQL         → assessment, session, transcript_turn, coverage_map,
   │                        portfolio, vacancy, user, org (public.organizations)
   ├── Redis + Sidekiq    → N5 StartHandler, N7 CoverageAnalyzer, N9 EndHandler,
   │                        N10 PortfolioGenerator, FitGapGenerator, SystemPromptGenerator
   └── Gemini API         → Live WS (suara) + HTTP generateContent (analisis/generasi)
```

### 6.3 Pipeline audio (bagian Ruby paling penting)

1. Kandidat buka `/interview/:token` → frontend membuka WS
   `ws://localhost:3001/ws/sessions/:id/audio?token=<invite_token>`.
2. **`AudioWebsocketMiddleware`** (Rack middleware) menjadi jembatan dua arah:
   browser ↔ **`Gemini::LiveClient`** (koneksi WS ke Gemini Live API).
3. **`Sessions::StartHandler`** (worker **N5**) mengaktivasi sesi + membuat `CoverageMap`
   per skill assessment (log: `Initialized N coverage map entries`).
4. Setiap giliran selesai, **`CoverageAnalyzerWorker`** (**N7**) menganalisis N turn terakhir
   (`TURNS_CONTEXT=6`) dengan model flash; **`Coverage::StateEngine`** mengatur transisi state
   `initiated → partial → covered` (forward-only, minimal `probe_count >= 2`).
5. Saat semua skill covered (logika di `map_injector.rb`) → suntik **`WRAP_UP_SIGNAL`**
   ke konteks Gemini → model menutup interview secara wajar.
6. **`Sessions::EndHandler`** (**N9**) mengakhiri sesi dengan reason
   `all_covered` / `time_ceiling` / `manual_candidate` / `error` → enqueue
   **`PortfolioGeneratorWorker`** (**N10**).
7. **`sanitize_output_transcription`** membersihkan kebocoran `[SISTEM]` / `[COVERAGE_MAP]`
   dan fragment JSON tanpa wrapper dari teks yang ditranskrip sebelum disimpan ke DB.

**Alur auto-end FE:** `preparing_to_end` → FE `draining_audio` → `POST audio_complete`
→ `sessions_controller.rb:118-129` → `EndHandler(reason: 'all_covered')`.

### 6.4 Multi-tenant & auth

- Organisasi disimpan di `public.organizations` dengan kolom **`scheme`** — dipakai sebagai
  nama schema (Apartment-style) sekaligus klaim JWT.
- **`AuthenticationController#authenticate`** memakai `skip_before_action :require_tenant!`
  karena login terjadi sebelum tenant ter-resolusi.
- JWT berisi `user_id`, `role`, `scheme`; `AuthorizeApiRequest` memvalidasi di request berikut.
- Role aktif saat ini: **admin** (satu-satunya yang bisa login; `role != 'admin'` ditolak) +
  **candidate** (tanpa akun, via `invite_token` di URL, hanya akses 2 endpoint publik:
  `candidate_info`, `audio_complete`).
- Kredensial admin seed: `admin@test-corp.com` / `admin123` (akun test lokal).

### 6.5 File penting (peta)

| File | Peran |
|---|---|
| `api/config/application.yml` | Konfigurasi model Gemini (`GEMINI_LIVE_MODEL`, `GEMINI_FLASH_MODEL`, `GEMINI_PRO_MODEL`) + secret env |
| `api/app/channels/audio_websocket_middleware.rb` | WS bridge; gating closing-phrase; `nudge_ai_to_continue`; `sanitize_output_transcription` |
| `api/app/clients/gemini/live_client.rb` | Live WS; `SILENCE_PUMP_DELAY = 2.5` |
| `api/app/clients/gemini/http_client.rb` | HTTP generateContent (flash/pro) |
| `api/app/services/assessments/system_prompt_compiler.rb` | Penyusun system prompt (rule 7/9, tone, instruksi coverage) |
| `api/app/services/coverage/analyzer.rb`, `state_engine.rb`, `map_injector.rb` | Analisis & state coverage, injeksi sinyal |
| `api/app/workers/coverage_analyzer_worker.rb` | Worker N7 |
| `api/app/services/sessions/start_handler.rb` (N5), `end_handler.rb` (N9) | Siklus hidup sesi |
| `api/app/services/portfolios/generator.rb` + `workers/portfolio_generator_worker.rb` (N10) | Portfolio kandidat |
| `api/app/controllers/api/v1/authentication_controller.rb` | Login admin + pesan error jujur |
| `api/app/controllers/api/v1/sessions_controller.rb` | `audio_complete` → EndHandler; `candidate_info` |
| `api/app/controllers/concerns/response.rb` | Envelope `{ errors: [{ status, message }] }` |
| `api/db/seeds.rb` | Org + 22 skill taxonomy + admin user (idempotent) |
| `web/src/stores/authAtom.ts` | Token hanya dari `localStorage` (backdoor dihapus) |
| `web/src/services/api.ts` | Interceptor 401/403; skip redirect saat di `/login` |
| `web/src/pages/auth/LoginPage.tsx` | Login; password toggle; menampilkan pesan error dari server |
| `web/src/hooks/useCoverageWebSocket.ts` | WS coverage + reconnect button |
| `web/src/pages/assessments/AssessmentEditPage.tsx` | Edit assessment + warning banner |

### 6.6 Perintah (user, manual)

```bash
# Backend — start (dari /home/risna/ai-interview-platform/api)
export PATH="$HOME/.rbenv/shims:$HOME/.rbenv/bin:$PATH"
setsid nohup bundle exec puma -C config/puma.rb > log/puma-dev.log 2>&1 < /dev/null &
setsid nohup bundle exec sidekiq -C config/sidekiq.yml > log/sidekiq-dev.log 2>&1 < /dev/null &

# Backend — stop
pkill -f puma; pkill -f sidekiq
# (bila master puma bandel: kill -TERM <pid>, lalu kill -9 <pid>)

# Seed (idempotent, aman diulang)
RAILS_ENV=development bundle exec rails db:seed

# Cek sintaks Ruby
ruby -c app/.../file.rb

# Frontend (dari /home/risna/ai-interview-platform/web)
npm run dev              # vite dev :5173
npx tsc --noEmit         # typecheck
```

> `setsid nohup ... < /dev/null &` penting agar proses tidak ikut mati saat sesi WSL ditutup.

### 6.7 Konvensi khusus

- **Secrets:** dilarang membaca/menampilkan isi `web/.env`, `web/.env.local`,
  `api/config/application.yml` (berisi DB password, JWT secret, Gemini API key).
  Gunakan `.env.example` / nama variabel. Menghapus variabel dari `.env` → pakai
  `sed -i '/^NAMA_VARIABEL=/d' file` (tanpa membuka isi).
- **WSL + PowerShell heredoc:** piping heredoc ke `wsl bash` merusak CRLF; pola aman:
  `$script | wsl bash -c "tr -d '\r' | bash -s"`. Untuk edit berbasis `sed` di WSL,
  pakai `sed < file` (bukan `sed file`) bila ragu ada CR.
- **Log:** diagnosis sesi → grep `api/log/development.log` dengan pola
  `N5`, `N7`, `N9`, `N10`, `[AudioWS]`.
- **Git:** branch `fix/interview-revamp`. Untuk perintah git dari PowerShell, kadang perlu
  workaround `safe.directory` karena path `//wsl.localhost/...`. Jangan commit tanpa diminta.

---

## 7. KEPUTUSAN TEKNIS PENTING (REKAM JEJAK)

1. **Model Gemini via env config** — default di kode (`gemini-2.0-flash-001`, `gemini-2.0-pro-001`)
   sudah deprecated → seluruh request Gemini gagal (401/404). Dipindah ke `application.yml`:
   satu sumber kebenaran, mudah diganti tanpa ubah kode. (P0)
2. **Silence pump 1s → 2.5s** — VAD Gemini memicu turn-complete terlalu cepat saat kandidat
   berhenti sebentar; kandidat terpotong. 2.5s memberi ruang berpikir. (P1)
3. **System prompt dirampingkan (±10KB → ±8.6KB)** — instruksi detail soal "sinyal rahasia"
   memancing model men-confabulate & mengucapkan teks internal. Aturan dibuat singkat &
   imperatif; ditambah "wait at least 3 seconds after a pause". Prompt di-cache di DB →
   wajib regenerate via `rails runner`. (P1)
4. **End-sesi hanya via backend** — model tidak dipercaya menutup interview. Fallback frase
   penutup (`CLOSING_PHRASES`) hanya final jika `state.coverage_pending` (backend sudah
   verifikasi via N7); selain itu `nudge_ai_to_continue` (maks 3×, `MAX_PREMATURE_CLOSE_NUDGES`). (P1)
5. **Login sungguhan** — seed admin (tabel `users` kosong sebelumnya), pesan error jujur
   (3 kasus dibedakan), tutup backdoor `VITE_DEV_TOKEN` di FE. (P1/P2)
6. **Graceful exit** — `WRAP_UP_SIGNAL` diubah agar AI menjawab pertanyaan kandidat dulu,
   menjelaskan "semua topik tercakup", lalu tutup natural. Tidak ada minimum duration gate —
   efisiensi dipertahankan, yang diperbaiki cara exit-nya. (P1)
7. **Assessment edit warning** — banner kuning saat sudah ada sesi selesai; editable tapi dengan
   peringatan perubahan hanya berlaku untuk sesi baru. (P2)
8. **Backend robustness** — `with_lock` cegah TOCTOU race, retry 2 handle transient API errors,
   empty transcript guard. (P1)
9. **Auth multi-role** — rename role sesuai brief (hiring_manager/assessor/recruiter),
   `ASSESSOR_ROLES` expanded, admin-only check dihapus, frontend store role + redirect.
   Semua role internal bisa login, candidate tetap via invite_token. (P2)
10. **Candidate-initiated close** — kandidat pamitan harus selalu dihormati. Branch C fallback
    inject `WRAP_UP_SIGNAL` langsung tanpa menunggu `coverage_pending`. Backend boleh override
    AI closing (untuk cegah premature end), tapi tidak boleh override kandidat. (P4)
11. **Time-critical nudge guard** — kalau `warn_120` atau `warn_60` sudah terkirim, AI closing
    langsung finalize. Sinyal waktu adalah source of truth tertinggi untuk pacing. (P4)
12. **Self-hosted speed test** — health check seharusnya tidak bergantung pada service external
    yang tidak terkontrol. `/api/v1/speed-test` memberi reliability. (P4)
13. **Frontend reconnection = backend grace period** — frontend harus try reconnect selama
    backend masih punya grace period (120 detik), bukan menyerah di 7 detik. (P4)
14. **Time warning 10 menit** — kandidat butuh waktu untuk wrap up jawaban. Warning di 10
    menit memberi buffer, di 5 menit memberi urgensi. (P4)

---

## 8. DOKUMEN TERKAIT

- `web/doc/ringkasan-phase-0.md` — rincian perubahan Phase 0 (apa/kenapa/mekanisme per item,
  kategori P0–P3, bekal arsitektur, backlog).
- `web/doc/analisa-gap-halaman-dan-fitur-rakamin-interview.md` — review awal produk, peta
  14 halaman, gap FE–BE, alur end-to-end, temuan (dead code SignupPage, role assessor belum real).
- `web/doc/result/transcript-session-2.txt` — bukti 3 masalah interview sebelum fix
  (terpotong saat jeda, bocor "Wait, input contains valid wrap_up signal...", closing dini).
- `README.md`, `api/README.md`, `web/README.md` — setup dasar.
