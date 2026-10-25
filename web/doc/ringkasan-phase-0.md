# RINGKASAN PROYEK & PERUBAHAN — PHASE 0

> **Konteks:** Case study Fullstack Product Engineer (Rakamin).
> Aplikasi: **AI Interview Platform** — wawancara suara real-time kandidat vs AI (Gemini Live API), penilaian cakupan skill, dan pembuatan portfolio kandidat.
> Dokumen ini bekal persiapan interview: memahami **rencana awal**, **semua perubahan yang sudah dikerjakan**, **alasan**, dan **arsitektur kode** (terutama bagian Ruby on Rails).

---

## DAFTAR ISI

1. [Rencana Awal (Roadmap P0–P3)](#1-rencana-awal-roadmap-p0p3)
2. [Ringkasan Perubahan Phase 0](#2-ringkasan-perubahan-phase-0)
3. [Bekal Arsitektur (Rails)](#3-bekal-arsitektur-rails)
4. [Backlog / Catatan](#4-backlog--catatan)

---

## 1. RENCANA AWAL (ROADMAP P0–P3)

Rencana disusun di awal pengerjaan (sebelum kode diubah), berdasarkan review menyeluruh:
peta halaman frontend, ketersambungan FE–BE, temuan bolong, dan alur end-to-end aplikasi
(detail review awal ada di `web/doc/analisa-gap-halaman-dan-fitur-rakamin-interview.md`).

| Prioritas | Cakupan | Tujuan |
|---|---|---|
| **P0 — Blocker** | Infrastruktur jalan: puma (API :3001), vite (FE :5173), sidekiq, Redis, PostgreSQL; Gemini API key + model valid; kandidat bisa masuk sesi (internet check + invite link); 1 sesi interview end-to-end sukses | Demo tidak boleh macet di infrastruktur |
| **P1 — Inti Demo** | Interview live stabil (3 masalah: AI memotong kandidat saat jeda, teks internal bocor diucapkan AI, sesi berakhir dini); coverage per skill benar; portfolio hasil interview; login admin dipakai sungguhan | Fitur utama yang dievaluasi berfungsi penuh |
| **P2 — Penyempurnaan** | Pesan error jujur; tutup backdoor auth; UX invite/share; fit-gap report; override portfolio; live monitor | Kualitas & kejelasan produk |
| **P3 — Polesan** | Dokumentasi per phase; pembersihan dead code (`SignupPage.tsx`); catatan teknis | Rapih, bisa dipertanggungjawabkan |

> Catatan: kategori ini juga dipakai untuk **mengelompokkan perubahan** di bagian 2 —
> setiap perubahan ditandai P0/P1/P2 sesuai dampaknya ke kelayakan demo.

---

## 2. RINGKASAN PERUBAHAN PHASE 0

### P0 — Blocker (yang membuat demo berjalan)

#### P0.1 Konfigurasi model Gemini — `api/config/application.yml`
- **Apa:** Model dikonfigurasi sebagai environment config:
  - `GEMINI_LIVE_MODEL` → model live WebSocket untuk wawancara suara
  - `GEMINI_FLASH_MODEL` → model analisis coverage (C2)
  - `GEMINI_PRO_MODEL` → model generator portfolio (C3)
- **Kenapa:** Default yang ter-hardcode di kode (`gemini-2.0-flash-001`, `gemini-2.0-pro-001`) sudah **tidak tersedia** di Gemini API → semua request 401/404 → interview live, coverage, dan portfolio semuanya gagal.
- **Mekanisme:** Panggilan Gemini dibuat melalui 3 client/service (lihat bagian 3), masing-masing membaca env config — satu titik sumber kebenaran, mudah diganti tanpa ubah kode.

#### P0.2 Perbaikan koneksi kandidat (internet check + invite link)
- **Apa:** Memperbaiki alur cek perangkat/koneksi kandidat dan pembuatan/membuka link undangan sesi.
- **Kenapa:** Kandidat tidak bisa masuk sesi / gagal lolos pemeriksaan hardware sebelum interview dimulai — blocker langsung untuk alur utama.

---

### P1 — Inti Demo (3 masalah interview + login)

#### P1.1 AI memotong kandidat saat jeda — `api/app/clients/gemini/live_client.rb`
- **Apa:** `SILENCE_PUMP_DELAY` dinaikkan dari `1` → `2.5` detik.
- **Kenapa:** Saat kandidat berhenti sebentar, backend mengirim **silence sintetis** ke Gemini Live agar VAD (Voice Activity Detection) Gemini mendeteksi akhir giliran bicara. Dengan delay 1 detik, jeda berpikir kandidat ("ee...") dianggap sudah selesai → AI memotong kandidat. 2.5 detik memberi ruang berpikir.
- **Mekanisme:** Di `live_client.rb`, bila tidak ada audio asli dalam N detik, library `Gemini::LiveClient` menyuntikkan paket silence ke koneksi WS; Gemini memprosesnya sebagai "diam" dan memicu `turnComplete`.
- **Alasan teknis untuk interview:** *"Keseimbangan antara latency dan kewajaran percakapan. Terlalu pendek = AI agresif memotong, terlalu panjang = wawancara terasa lambat. 2.5s adalah kompromi setelah observasi langsung."*

#### P1.2 Teks internal "wrap_up signal" bocor diucapkan AI — `api/app/services/assessments/system_prompt_compiler.rb`
- **Apa:** System prompt dirampingkan:
  - Rule 7 → **"YOU CANNOT CLOSE THE INTERVIEW... Only the system can end it."**
  - Rule 9 → instruksi wrap-up hanya jika sistem memberi sinyal (`wrap_up: true`), maksimal 2 kalimat.
  - Blok `IMPORTANT` tentang coverage → tanpa "kuliah autentikasi sinyal"; cukup "never read them aloud".
  - Tone section → tambah "wait at least 3 seconds after a pause before responding".
- **Kenapa:** Prompt lama menjelaskan panjang lebar soal **sinyal tersembunyi** (token autentikasi, aturan `WRAP_UP_SIGNAL`, narasi "hidden messages"). Ini **memancing** model untuk men-confabulate dan **mengucapkan** teks internal, terbukti di transcript sesi 2: *"Wait, input contains valid wrap_up signal..."*. Padahal backend **tidak pernah** mengirim sinyal itu (log membuktikan `skills_remaining` selalu 2 dan `all_covered?` tidak pernah true).
- **Mekanisme:** `SystemPromptCompiler` merakit prompt dari config assessment (role title + rubrik skill) dan disimpan ke kolom `assessments.system_prompt`. Prompt turun dari ±10.000 → ±8.600 bytes.
- **Alasan teknis untuk interview:** *"Instruksi injeksi internal yang terlalu detail menimbulkan 'prompt injection oleh diri sendiri' — model jadi percaya bahwa sinyal adalah bagian dari percakapan. Aturan harus singkat dan imperatif."*

#### P1.3 Sesi berakhir dini dengan alasan `all_covered` — `api/app/channels/audio_websocket_middleware.rb`
- **Apa:** Logika *closing-phrase fallback* diubah agar **hanya** memfinalisasi sesi jika `state.coverage_pending` sudah benar (backend sudah memverifikasi semua skill covered). Jika AI menutup interview lebih awal, backend mengirim `CONTINUE_SIGNAL` ("[SISTEM] Interview belum selesai...") untuk menyuruh lanjut — dibatasi maksimal 3× (`MAX_PREMATURE_CLOSE_NUDGES`, dilacak di `ConnectionState#nudge_count`).
- **Kenapa:** Model menutup sendiri di turn 17 tanpa sinyal backend, lalu fallback frase penutup **memaksa** `coverage_pending` → FE menerima `preparing_to_end` → `POST audio_complete` → `sessions_controller.rb:127` mengakhiri sesi (reason `all_covered`) **tanpa verifikasi ulang** — padahal 2 skill belum tercakup dan jatah waktu 45 menit.
- **Mekanisme:**
  1. Backend mendeteksi frase penutup AI (`CLOSING_PHRASES`, mis. "thank you for your time") di transkrip output.
  2. Bila `coverage_pending == true` → timer 15 detik → kirim `preparing_to_end` ke FE → FE drain audio → `audio_complete` → `EndHandler(reason: 'all_covered')`.
  3. Bila `coverage_pending == false` → **nudge** AI agar melanjutkan (bukan mengakhiri).
- **Alasan teknis untuk interview:** *"Keputusan mengakhiri interview tidak boleh diserahkan ke model. Backend adalah source of truth: sesi hanya berakhir jika analyzer coverage menyatakan semua skill covered, atau waktu habis, atau kandidat/manual mengakhiri."*

#### P1.4 Graceful exit — AI mengakhiri interview dengan transparan dan sopan
- **Apa:**
  - `WRAP_UP_SIGNAL` diubah dari "Close the interview NOW. Do NOT ask any more questions." → izinkan AI menjawab pertanyaan kandidat dulu, lalu jelaskan "semua topik sudah tercakup", tutup secara natural.
  - System prompt rule 9 diubah dari "WRAP UP" → "GRACEFUL EXIT": AI harus transparan alasan interview berakhir, bukan ghosting.
  - Kolom `assessments.system_prompt` di-regenerate untuk semua 4 assessment via `rails runner`.
- **File:** `api/app/channels/audio_websocket_middleware.rb` (WRAP_UP_SIGNAL) + `api/app/services/assessments/system_prompt_compiler.rb` (rule 9).
- **Kenapa:** Sebelumnya, saat `all_covered?` = true, AI langsung menutup interview dengan "Terima kasih atas waktunya" **tanpa menjawab pertanyaan kandidat** dan **tanpa menjelaskan kenapa**. Kandidat merasa di-ghosting. Interview 8 menit untuk slot 90 menit tanpa penjelasan = buruk UX.
- **Efisiensi dipertahankan:** Tidak ada minimum duration gate — interview boleh berakhir cepat jika semua skill sudah tercakup. Yang diperbaiki adalah **cara exit-nya**, bukan durasinya.
- **Alasan teknis untuk interview:** *"Efficiency is good, but the exit must be respectful. The candidate should leave feeling their time was valued, not cut off abruptly."*

#### P1.5 Regenerate system prompt di database
- **Apa:** Kolom `assessments.system_prompt` di-update ulang untuk semua assessment (id 1–4) via `rails runner`.
- **Kenapa:** `system_prompt` **di-cache di DB** saat assessment dibuat/diupdate — mengubah compiler saja tidak cukup; sesi berikutnya akan tetap memakai prompt lama yang bermasalah.

#### P1.6 Login admin dipakai sungguhan — `api/db/seeds.rb` + `web/src/stores/authAtom.ts`
- **Apa:**
  - **Seed akun admin** `admin@test-corp.com` / `admin123` (role `admin`, idempotent via `User.find_or_initialize_by`). Sebelumnya tabel `users` **kosong** — tidak ada siapa pun yang bisa login.
  - **Backdoor ditutup:** `getStoredToken()` tidak lagi fallback ke `import.meta.env.VITE_DEV_TOKEN` → hanya membaca `localStorage`. Referensi `VITE_DEV_TOKEN` dihapus dari `.env.example`, `README.md`, dan `web/.env` (dihapus via `sed`, tanpa membuka isi file).
- **Kenapa:** Token dev yang dibundel ke frontend membuat siapa pun otomatis "login" tanpa autentikasi — jalan belakang yang tidak pantas untuk demo. Kini alur login sungguhan (email + password) yang dipakai.

---

### P2 — Penyempurnaan (kejelasan & UX login)

#### P2.1 Pesan error jujur — `api/app/controllers/api/v1/authentication_controller.rb` + `web/src/pages/auth/LoginPage.tsx`
- **Apa:** Backend membedakan 3 kasus kegagalan (semua HTTP 401):
  - Email tidak terdaftar → `Email not registered`
  - Password salah → `Wrong password`
  - Bukan role admin → `Account is not an admin`
- Frontend membaca `err.response.data.errors[0].message` dan menampilkannya (fallback ke pesan lama), tidak lagi hardcode.
- **Kenapa:** Pesan seragam "Invalid email or password" menyulitkan debugging dan terkesan tidak jujur pada pengguna.

#### P2.2 Redirect ganda saat login gagal — `web/src/services/api.ts`
- **Apa:** Interceptor HTTP 401/403 hanya redirect ke `/login` jika path saat ini **bukan** `/login`.
- **Kenapa:** Sebelumnya, login yang gagal (401) memicu `window.location.href = "/login"` → **reload penuh halaman** → pesan error tidak pernah terlihat oleh pengguna.

#### P2.3 Password visibility toggle — `web/src/pages/auth/LoginPage.tsx`
- **Apa:** Tombol `Eye`/`EyeOff` di ujung kanan input password. Toggle antara `type="password"` dan `type="text"`.
- **Kenapa:** UX — kandidat bisa memastikan password yang diketik benar sebelum submit.

#### P2.4 Clipboard fallback — `web/src/pages/assessments/AssessmentInvitePage.tsx`
- **Apa:** Fungsi `copyToClipboard()` yang try `navigator.clipboard.writeText()` dulu, fallback ke `document.execCommand('copy')` via temporary textarea.
- **Kenapa:** `navigator.clipboard` hanya works di secure context (HTTPS/localhost). Di HTTP, copy link undangan gagal silently.

#### P2.5 Reconnect button — `web/src/hooks/useCoverageWebSocket.ts` + `web/src/pages/monitor/LiveMonitorPage.tsx`
- **Apa:** `useCoverageWebSocket` mengembalikan `reconnect()` function yang reset attempts dan reconnect manual. Live Monitor menampilkan tombol "Reconnect" saat WS disconnect.
- **Kenapa:** Setelah 3× reconnect gagal, user stuck tanpa cara manual reconnect. Tombol Reconnect memberi kontrol ke admin.

#### P2.6 Assessment edit warning — `web/src/pages/assessments/AssessmentEditPage.tsx`
- **Apa:** Banner kuning di halaman edit assessment jika sudah ada sesi yang selesai. Pesan: perubahan hanya berlaku untuk sesi baru.
- **Kenapa:** Admin perlu tahu bahwa mengubah skill tidak mempengaruhi coverage map dan portfolio yang sudah ada.

#### P2.7 Error states — `PortfolioPage.tsx`, `FitGapReportPage.tsx`, `AssessmentInvitePage.tsx`, `LiveMonitorPage.tsx`
- **Apa:** Semua halaman utama kini punya error state + error UI saat API call gagal atau portfolio tidak ditemukan.
- **Kenapa:** Sebelumnya `.catch(() => {})` menelan error — halaman menampilkan kosong tanpa penjelasan.

#### P2.8 Fit-gap field mismatch — `web/src/types/index.ts` + `ComparisonTable.tsx`
- **Apa:** `SkillComparison.required_level` → `expected_level` (sesuai backend `fit_gap/engine.rb`).
- **Kenapa:** Backend mengirim `expected_level`, frontend expect `required_level` → kolom "Required" kosong di tabel.

#### P2.9 Auth multi-role — rename role sesuai brief
- **Apa:**
  - `User::ROLES` diubah dari `%w[admin user]` → `%w[hiring_manager assessor recruiter]`.
  - `ASSESSOR_ROLES` diubah dari `%w[admin assessor]` → `%w[hiring_manager assessor recruiter]`.
  - Admin-only check (`user.role == 'admin'`) dihapus dari `authentication_controller.rb` → semua role internal bisa login.
  - Seeds: 3 user (`hiring_manager@test-corp.com` / `admin123`, `assessor@test-corp.com` / `assessor123`, `recruiter@test-corp.com` / `recruiter123`).
  - Migration `20260506000000_rename_user_roles.rb`: update default role `'user'` → `'recruiter'` + update existing rows.
  - Frontend: `authAtom.ts` store `{ token, user }` (termasuk role); `LoginPage.tsx` redirect berdasarkan role.
  - `auth.ts` LoginResponse ditambah `user: { id, email, role }`.
  - `api.ts` + `AssessorLayout.tsx`: import `clearAuth` (bukan `clearToken`).
- **Kenapa:** Brief case study mendefinisikan 4 user type: **hiring_manager** (admin dashboard), **assessor** (monitor sesi), **recruiter** (kelola rekrutmen), **candidate** (via invite_token). Sebelumnya hanya admin yang bisa login — assessor dan recruiter tidak punya akses. Rename role + multi-role auth menunjukkan pemahaman RBAC dan monozukuri (craftsmanship).
- **File:** `api/app/models/user.rb`, `api/app/auth/authorize_api_request.rb`, `api/app/controllers/api/v1/authentication_controller.rb`, `api/db/seeds.rb`, `api/db/migrate/20260506000000_rename_user_roles.rb`, `web/src/stores/authAtom.ts`, `web/src/services/auth.ts`, `web/src/pages/auth/LoginPage.tsx`, `web/src/services/api.ts`, `web/src/components/layout/AssessorLayout.tsx`.
- **Alasan teknis untuk interview:** *"Multi-role auth demonstrates understanding of RBAC architecture. The brief explicitly defines 4 user types — aligning the codebase to match shows attention to product requirements and system design rigor."*

### P3 — Polesan

#### P3.1 Dead code cleanup
- **Apa:** `web/src/pages/auth/SignupPage.tsx` dihapus (106 lines, zero references — tidak di-route, backend tidak punya `/signup`). `authApi.signup()` dihapus dari `web/src/services/auth.ts`.
- **Kenapa:** Dead code membingungkan dan menambah noise di codebase.

#### P3.2 Backend robustness — `api/app/services/sessions/end_handler.rb`, `api/app/workers/coverage_analyzer_worker.rb`, `api/app/services/portfolios/generator.rb`
- **Apa:**
  - `EndHandler#call` dibungkus `@session.with_lock` — cegah TOCTOU race condition saat dua proses mengakhiri sesi yang sama.
  - `CoverageAnalyzerWorker` retry `0` → `2` — handle transient API errors (503, timeout).
  - `Generator#call` tambah guard empty transcript — return early jika transcript kosong.
- **Kenapa:** TOCTOU race bisa buat portfolio ganda; retry 0 permanen gagal saat API down sesaat; empty transcript kirim prompt kosong ke Gemini.

---

### P4 — Bug Fixes & Resilience (testing-based fixes)

#### P4.1 Auto-end saat kandidat pamitan — `audio_websocket_middleware.rb:199-217`
- **Apa:** Tambah Branch C di `candidate_closing_handled` — kalau kandidat pamitan tapi belum `coverage_pending` dan belum `wrap_up_injected`, langsung inject `WRAP_UP_SIGNAL` + set `wrap_up_injected = true`.
- **Kenapa:** Sebelumnya, hanya 2 branch: (A) `wrap_up_injected` → finalize, (B) `coverage_pending` → inject wrap-up. Kalau keduanya false (misal discovered skill masih `initiated`), kandidat pamitan **diabaikan** — interview lanjut terus sampai waktu habis. Di session 17, kandidat bilang "Goodbye" 3× tapi AI tetap nanya.
- **Mekanisme:** Branch C adalah fallback — inject `WRAP_UP_SIGNAL` langsung ke Gemini tanpa menunggu `coverage_pending`. AI akan menjawab pertanyaan kandidat (jika ada), lalu menutup interview secara natural.
- **Alasan teknis untuk interview:** *"Candidate-initiated close harus selalu dihormati. Backend boleh override AI closing (untuk cegah premature end), tapi tidak boleh override kandidat yang sudah jelas pamitan."*

#### P4.2 Transcript leak JSON — `audio_websocket_middleware.rb:305-319`
- **Apa:** Perluas regex `sanitize_output_transcription`:
  - Regex (3): `\A\s*\{` → `\A\s*[, {]*\{` — tangkap fragment mulai dengan `, "discovered"`.
  - Regex (4): `\p{Lu}` → `[A-Za-z—]` — tangkap karakter setelah `}]` termasuk em-dash.
  - Tambahan safety check: kalau teks masih mulai dengan `[,{[]`, discard seluruh turn.
- **Kenapa:** Di session 17, fragment JSON seperti `, "discovered": [{"label": "Financial Systems"...}]` muncul di transcript karena regex lama tidak match — fragment mulai dengan koma (bukan `{`), dan karakter setelah `}]` adalah em-dash (bukan `\p{Lu}`).
- **Alasan teknis untuk interview:** *"Sanitize regex harus cukup luas menangkap berbagai format fragment JSON yang mungkin leak, tapi tidak terlalu agresif sehingga menghapus teks kandidat yang valid."*

#### P4.3 AI loop nudge kontradiktif — `audio_websocket_middleware.rb:280-298`
- **Apa:** Tambah check `time_critical` — kalau `warn_120` atau `warn_60` sudah terkirim, AI closing langsung finalize, bukan di-nudge.
- **Kenapa:** Sebelumnya, AI closing → `coverage_pending` false → nudge → AI closing lagi → nudge lagi → loop sampai waktu habis. Terjadi karena coverage map bilang "pacing: critical" (wrap up) tapi nudge bilang "lanjut" — dua sinyal berlawanan.
- **Mekanisme:** `time_critical = state.sent_time_warnings.include?(:warn_120) || state.sent_time_warnings.include?(:warn_60)`. Kalau true, treat sama dengan `coverage_pending` → finalize via timer 15 detik.
- **Alasan teknis untuk interview:** *"Sinyal waktu adalah source of truth tertinggi untuk pacing. Kalau backend sudah bilang 'waktu kritis', AI harus diizinkan close — nudge di titik ini kontraproduktif."*

#### P4.4 Retry button hard refresh — `HardwareCheck.tsx:178-181`
- **Apa:** `retryAll()` diubah dari reset React state menjadi `window.location.reload()`.
- **Kenapa:** Reset state hanya menjalankan ulang speed test yang sama — cached/failed network state tetap ada. Hard refresh membersihkan semua.
- **Alasan teknis untuk interview:** *"Hardware check melibatkan aspek sistem (camera, mic, internet) yang bisa stale di level browser. Hard refresh adalah satu-satunya cara memastikan state benar-benar bersih."*

#### P4.5 Interview page retry on lost — `InterviewPage.tsx:298-309`
- **Apa:** Banner connection lost ditambah tombol "Refresh Page" yang call `window.location.reload()`.
- **Kenapa:** Sebelumnya, banner hanya menampilkan pesan statis — kandidat tidak bisa melakukan apa-apa selain menunggu. Tombol memberi kontrol aktif.
- **Alasan teknis untuk interview:** *"Candidate experience harus memberi rasa kontrol. 'Please wait' tanpa aksi menimbulkan kecemasan; tombol refresh memberi harapan konkret."*

#### P4.6 Self-host speed test endpoint — `internetSpeedTest.ts:106-120`
- **Apa:** Upload speed test sekarang pakai self-hosted `/api/v1/speed-test` sebagai primary, httpbin jadi fallback. Tambah `response.ok` check — 503 skip, bukan hitung sebagai sukses.
- **Kenapa:** httpbin.org sering return 503 (Service Unavailable) atau timeout — menghasilkan speed test yang tidak akurat. Self-hosted endpoint tidak punya rate limit dan selalu tersedia.
- **Mekanisme:** Rails route `POST /api/v1/speed_test` (sudah ada di `routes.rb:14-17`) accept payload, hitung bytes, return JSON. Frontend pakai `VITE_API_URL` sebagai base URL.
- **Alasan teknis untuk interview:** *"Health check seharusnya tidak bergantung pada service external yang tidak terkontrol. Self-hosted memberi reliability dan menghilangkan dependency internet untuk testing internet."*

#### P4.7 Rejoin option on bad internet — `useAudioWebSocket.ts:15`, `InterviewPage.tsx:244-258`
- **Apa:**
  - `RECONNECT_DELAYS` diperpanjang dari `[1s, 2s, 4s]` → `[1s, 2s, 4s, 8s, 16s, 32s, 64s, 120s]` — total 8 attempts, ~247 detik.
  - State `"failed"` ditambah ke `InterviewState` union type — tampilan retry screen dengan tombol "Retry Interview".
  - Tidak lagi panggil `onStateChange("complete")` saat reconnection gagal.
- **Kenapa:** Frontend lama hanya try 3× (7 detik total) lalu tampil "Interview Complete" — menyesatkan karena sesi belum selesai. Backend punya grace period 120 detik, tapi frontend sudah menyerah di 7 detik.
- **Alasan teknis untuk interview:** *"Frontend reconnection window harus sinkron dengan backend grace period. Kandidat harus punya waktu yang cukup untuk reconnect, bukan langsung dianggap selesai."*

#### P4.8 Time warning 10 menit — `audio_websocket_middleware.rb:689-701`, `InterviewTimer.tsx`, `InterviewPage.tsx:95-101`
- **Apa:**
  - Backend: tambah tier `:warn_600` di `check_time_ceiling` — kirim signal ke Gemini saat sisa waktu ≤10 menit.
  - Frontend: `InterviewTimer` tambah `isCaution` threshold (≤10 menit, warna amber redup) + `onTimeWarning` callback.
  - Frontend: `InterviewPage` tampilkan banner amber "Sisa waktu X menit" yang auto-dismiss 5 detik.
- **Kenapa:** Sebelumnya hanya ada warning di 2 menit dan 1 menit — terlalu lambat untuk memberi kandidat kesempatan wrap up jawaban. 10 menit memberi buffer untuk AI mulai beralih ke topik ringan.
- **Alasan teknis untuk interview:** *"Time awareness adalah UX penting dalam interview. Kandidat yang tahu waktu tersisa bisa mengatur panjang jawaban — tanpa awareness, mereka terkejut saat interview tiba-tiba berakhir."

---

## 3. BEKAL ARSITEKTUR (RAILS)

### 3.1 Stack & alur request
```
Browser (Vite :5173)
   │  REST / WebSocket
   ▼
Rails API (Puma :3001)
   │
   ├── PostgreSQL        (data: assessment, session, coverage_map, transcript, portfolio, user)
   ├── Redis + Sidekiq   (background jobs: coverage, portfolio, fit-gap)
   └── Gemini API        (live WebSocket + HTTP generateContent)
```

### 3.2 Pipeline audio (bagian paling penting)
1. Kandidat membuka `/interview/:token` → frontend membuka WebSocket `ws://localhost:3001/ws/sessions/:id/audio`.
2. **`AudioWebsocketMiddleware`** (Rack middleware) menjembatani browser ↔ Gemini Live WebSocket (`Gemini::LiveClient`).
3. **`Sessions::StartHandler`** (worker N5) mengaktivasi sesi + membuat `CoverageMap` per skill assessment.
4. Setiap giliran, **`CoverageAnalyzerWorker`** (N7) menganalisis N turn terakhir (TURNS_CONTEXT=6) dengan model flash; **`Coverage::StateEngine`** mengatur transisi state `initiated → partial → covered` (forward-only, minimal 2 probe).
5. Saat semua skill covered → `MapInjector` menyuntikkan `WRAP_UP_SIGNAL` → model menjawab pertanyaan kandidat (jika ada), menjelaskan bahwa semua topik sudah tercakup, lalu menutup interview secara wajar dan sopan.
6. **`Sessions::EndHandler`** (N9) mengakhiri sesi (reason: `all_covered` / `time_ceiling` / `manual_candidate` / `error`) → enqueue **`PortfolioGeneratorWorker`** (N10).
7. `sanitize_output_transcription` membersihkan kebocoran `[SISTEM]` / `[COVERAGE_MAP]` dari transkrip yang disimpan.

### 3.3 Multi-tenant & auth
- Organisasi ada di `public.organizations` dengan kolom **`scheme`** — dipakai sebagai nama schema (Apartment-style) sekaligus klaim JWT.
- `AuthenticationController#authenticate` menggunakan `skip_before_action :require_tenant!` karena login terjadi **sebelum** tenant ter-resolusi.
- JWT berisi `user_id`, `role`, `scheme`; `AuthorizeApiRequest` memvalidasinya di request berikutnya.
- Role saat ini: **admin** (satu-satunya yang bisa login, `role != 'admin'` ditolak) + **candidate** (tanpa akun, lewat `invite_token` di URL, akses 2 endpoint publik).

### 3.4 Model & data utama
- `Assessment` + `AssessmentSkill` — rubrik skill interview (role title + skill + anchor level).
- `Session` + `TranscriptTurn` — sesi interview + percakapan.
- `CoverageMap` — status cakupan per skill (`initiated`/`partial`/`covered`, `probe_count`, `is_discovered`).
- `Portfolio` + `PortfolioSkill` — hasil penilaian kandidat.
- `Vacancy` + `VacancySkill` — lowongan; `FitGapReport` — perbandingan portfolio vs vacancy.

---

## 4. BACKLOG / CATATAN

| Item | Status | Catatan |
|---|---|---|
| Fitur lanjutan (Tier lanjutan: export, dashboard, dsb.) | Belum | Prioritas setelah demo inti stabil |
| Audio recording untuk assessors/HR | Ide | Phase berikutnya — simpan audio interview agar assessors bisa dengar ulasan kandidat |
| Git commit | Belum | Branch `fix/interview-revamp`, belum ada commit (user handle sendiri) |

---
*Dibuat: 16 Agu 2026. Diperbarui: 17 Agu 2026.*
