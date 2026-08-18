# ROADMAP — Case Study Fullstack Product Engineer (Rakamin)

Deadline: **Rabu 19 Agustus, 13:00 WIB**. Dasar temuan: [`codebase-audit.md`](codebase-audit.md)
dan [`MY-TASK.md`](MY-TASK.md) (sudah ada, tidak diaudit ulang — hanya dirujuk).

## Bisa langsung dikerjakan SEKARANG, tanpa nunggu apa pun
1. **Isi 5 decision gate di §4** — ini blocker semua yang lain, kerjakan duluan.
2. **Ambil GEMINI_API_KEY asli** (§1.4) — kalau kamu tidak punya, ini menentukan opsi mana di §4.1 yang REALISTIS dipilih.
3. Branch sudah dibuat: `revamp/case-study-prep` (ganti nama setelah §4.1 diputuskan, `git branch -m nama-baru`).
4. Baca ulang `codebase-audit.md` §6 (tabel F-01…F-14) sambil isi §4.1 — jangan pilih sambil buta.
5. Setup lokal **sudah selesai dan sudah diverifikasi jalan** (§1) — kamu bisa langsung buka `localhost:5173` dan login sekarang juga, tidak perlu setup ulang.

---

## Langkah 1 — Local Setup Playbook (sudah dijalankan & diverifikasi nyata)

### Status akhir: KEDUA SERVICE JALAN, login+create+invite sudah dites manual di browser.

### Yang README **tidak** bilang tapi ternyata blocker nyata di mesin ini
| # | Masalah nyata | Fix yang benar-benar jalan |
|---|---|---|
| 1 | Ruby sistem 3.4.5, project pin `3.3.2` (`.ruby-version`, `Gemfile:5`) — `bundle install` gagal keras, bukan warning | Install `rbenv`+`ruby-build` via brew, `rbenv install 3.3.2`, `rbenv local 3.3.2` di `api/` |
| 2 | `bundle` di PATH resolve ke Ruby sistem 2.6.10 (`/usr/bin/bundle`), bukan Ruby aktif | `gem install bundler -v 2.5.11` di ruby yang benar, pastikan `~/.rbenv/shims` di depan PATH |
| 3 | Postgres & Redis **tidak terinstall sama sekali** di mesin ini | `brew install postgresql@15 redis` |
| 4 | Redis default config (`/opt/homebrew/etc/redis.conf`) punya `loadmodule redisbloom` yang filenya tidak ada → Redis **crash saat start** | Jalankan `redis-server` TANPA config itu: `redis-server --port 6379 --daemonize yes` |
| 5 | Role `postgres` tidak ada (Homebrew Postgres cuma bikin role sesuai username macOS) | `createuser -s postgres` |
| 6 | `config/application.yml` tidak ada (memang gitignored, harus dibuat manual) | `cp config/application.yml.sample config/application.yml`, isi `SECRET_KEY_BASE` (generate: `openssl rand -hex 64`), `DB_USERNAME=postgres`, `DB_PASSWORD=""` |
| 7 | **`web/.env.example` salah** — default `VITE_API_BASE_URL`/`VITE_WS_BASE_URL` pakai port **3000**, tapi `api/config/puma.rb:19` pin port **3001** (dan `web/README.md` sendiri bilang 3001) | Pakai port **3001** di `web/.env`, abaikan default di `.env.example` |
| 8 | **Puma cluster mode (`workers: 2`, default bahkan di development — `config/puma.rb:10`) crash di macOS**: `objc[...]: +[NSNumber initialize] may have been in progress... Crashing instead.` — fork-safety issue Objective-C runtime klasik | Prefix start command: `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES bundle exec rails server` |
| 9 | Seed (`db:seed`) **tidak membuat satu pun `User` record** — cuma Organization + 22 skill taxonomy. Form login di `/login` tidak ada kredensial yang bisa dipakai out of the box | Buat manual: `bundle exec rails runner` dengan `User.create!(email:, password:, role: 'admin')` — kredensial dipakai untuk verifikasi: **`assessor@test-corp.local` / `Password123!`** |
| 10 | `Session#invite_url` pakai `APP_BASE_URL` (`api/app/models/session.rb:29`) — kalau nilainya ikut sample (`http://localhost:3001`), link kandidat **mengarah ke API, bukan ke React app** → dibuka = Rails routing error page. **Dikonfirmasi nyata** dengan klik link asli dari UI. | `APP_BASE_URL` harus `http://localhost:5173` (port Vite), bukan port API |

### Command urutan lengkap yang TERBUKTI jalan dari nol (macOS + Homebrew)
```bash
# 1. Ruby yang benar
brew install rbenv ruby-build
rbenv install 3.3.2
cd api && rbenv local 3.3.2
gem install bundler -v 2.5.11

# 2. Postgres + Redis
brew install postgresql@15 redis
brew services start postgresql@15
redis-server --port 6379 --daemonize yes   # BUKAN `brew services start redis` — lihat tabel #4

# 3. Role & database
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
createuser -s postgres
createdb -U postgres rakamin_development
createdb -U postgres rakamin_test

# 4. Config (isi manual sesuai tabel #6 & #10 di atas)
cp config/application.yml.sample config/application.yml

# 5. Install, migrate, seed
bundle install
bundle exec rails db:migrate
bundle exec rails db:seed

# 6. Buat user login (tabel #9) — jalankan rails runner dengan User.create!(...)

# 7. Start — DUA proses terpisah
OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES bundle exec rails server   # :3001
bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml

# 8. Frontend
cd ../web
cp .env.example .env   # lalu perbaiki port ke 3001, lihat tabel #7
npm install
npm run dev   # :5173
```

### Yang sudah dites manual di browser (bukti, bukan asumsi)
- ✅ Login dengan kredensial di atas → masuk ke `/assessments`, render kosong sesuai empty-state pattern.
- ✅ Buat assessment ("QA Engineer Screening", 45 menit, skill dari B7 taxonomy, expected L3) → tersimpan, Sidekiq **benar-benar memproses** `SystemPromptGeneratorWorker` (dikonfirmasi dari log Sidekiq, elapsed 0.169s).
- ✅ Generate invite link untuk kandidat "Budi Santoso" → link ter-generate.
- ❌→✅ Klik link asli (port 3001) → Rails error page (masalah #10 di atas). Setelah port dikoreksi ke 5173 → halaman hardware-check kandidat render sempurna (OS & browser: Passed, role title & durasi tampil benar).
- Nol error di console browser sepanjang alur ini.

### GEMINI_API_KEY — RESOLVED, kunci asli sudah terpasang & tervalidasi
Kamu sudah kasih API key asli — sudah dipasang ke `config/application.yml` (tetap gitignored,
dikonfirmasi via `git status`, tidak pernah muncul sebagai tracked file) dan divalidasi dengan
panggilan `generateContent` sungguhan (respons "OK" diterima). **Tapi model name di
`.sample` sudah semuanya mati** — baik `gemini-2.0-*` maupun `gemini-2.5-*` sekarang 404
("no longer available to new users"). Model yang benar-benar jalan untuk key ini per hari ini:
- `GEMINI_LIVE_MODEL = gemini-3.1-flash-live-preview` (bidiGenerateContent, dikonfirmasi ada)
- `GEMINI_FLASH_MODEL = gemini-3.6-flash` (dikonfirmasi, real call sukses)
- `GEMINI_PRO_MODEL = gemini-3.6-flash` (**sementara** — Pro asli `gemini-3.1-pro-preview`
  terkonfirmasi ADA untuk key ini tapi cuma di endpoint `v1beta`, sedangkan
  `Gemini::HttpClient::BASE_URL` di kode hardcode `v1` — lihat `api/app/clients/gemini/http_client.rb:5`.
  Kalau kualitas N10/portfolio generator dengan Flash terasa kurang, ini titik yang perlu
  diputuskan: ganti `BASE_URL` ke `v1beta`, atau terima Flash sebagai pengganti Pro untuk
  case study ini.)

Artinya: **hardware-check kandidat + interview suara sungguhan sekarang bisa dites penuh**
selama mic browser tersedia — tidak ada lagi blocker konfigurasi tersisa di sisi Gemini.

---

## Langkah 2 — 5 Pilar Konteks (ringkas, rujuk audit untuk detail)

**1. Produk** — Dites langsung end-to-end (lihat bukti §1): assessor bikin config skill →
sistem generate system prompt (Sidekiq, terbukti jalan) → invite kandidat → kandidat lewati
hardware check → (butuh Gemini key untuk lanjut) → coverage map ter-update real-time ke
dashboard assessor (arsitektur Redis pub/sub, dikonfirmasi ada di kode) → portfolio + fit/gap +
PDF export. Detail teknis lengkap: `codebase-audit.md` §1-§2.

**2. Industri** — Hiring assessment Indonesia: yang sudah komoditas = tes coding generik
(HackerRank-style), jadwal interview manual, screening resume keyword-based. Leverage nyata
produk ini = AI yang benar-benar **probe** seperti interviewer manusia (PRD-01 eksplisit
melarang "question list behavior") plus bukti berbasis kutipan langsung, bukan skor buram.
Kalau probing-nya terasa seperti kuis chatbot, produk ini jatuh ke kategori komoditas yang sama
dengan kompetitor generik.

**3. Tujuan Produk** — Outcome: sinyal hiring yang defensible + hemat waktu assessor
dibanding interview tak terstruktur. Yang harus tetap benar: aturan coverage (`probe_count>=2`)
benar-benar ditegakkan (audit konfirmasi: SESUAI, ditegakkan di kode — lihat F-item #5 di audit),
tidak ada kebocoran data lintas kandidat/tenant (audit konfirmasi: **GAGAL**, F-01), narasi
fit/gap berbasis bukti bukan generik (audit konfirmasi: **PARSIAL**, F-05).

**4. Users (assessor/recruiter/hiring manager)** — Hari kerja mereka: banyak kandidat paralel,
butuh sinyal cepat yang bisa dipercaya tanpa re-listen rekaman penuh. UI yang sudah ada
(`LiveMonitorPage`, override panel di `PortfolioPage`) dibangun tepat untuk ini — sudah dites
render dengan baik. Assessor **harus bisa percaya** angka confidence dan narasi yang mereka
lihat — ini yang dirusak F-04 dan F-05.

**5. Kandidat (yang tidak pernah memilih produk ini)** — Tidak bisa opt-out, hasil salah
mengubah tahun hidup mereka nyata. Implikasi UU PDP konkret sudah dipetakan di audit §4:
kebocoran lintas tenant (F-01, **P0**), tidak ada retensi/penghapusan data (F-02, **P0**),
potensi kebocoran sinyal penilaian tersembunyi ke kandidat lewat channel WS yang salah (F-03,
**P1**, ada bukti nyata di kode).

---

## Langkah 3 — Inventori Desain & Arah Visual

### Yang sudah ada (extend ini, jangan reinvent)
- **Token system lengkap** via CSS variables (`web/src/index.css:6-38`) + Tailwind config
  (`tailwind.config.js:7-41`) — bukan warna hardcode. Brand asli Rakamin sudah dipakai:
  primary teal `#01959f`, secondary yellow `#FBC037`.
  - **Dark mode variables ADA** (`index.css:40-68`) tapi **tidak ada toggle/switcher di mana
    pun** (dikonfirmasi `grep`, nihil) — mati, tidak dipakai.
- **Radix UI primitives**: accordion, alert-dialog, dialog, dropdown-menu, label, progress,
  radio-group, select, separator, tabs, tooltip — semua sudah dipasang dan dipakai konsisten.
  **Tidak ada `@radix-ui/react-toast`** — semua feedback aksi (copy link, save override)
  pakai inline text-swap sementara ("Copied!"), bukan toast/notification system.
- **Pola state list-page yang konsisten dan berulang** (dikonfirmasi identik di
  `AssessmentListPage.tsx` dan `VacancyListPage.tsx`): `Skeleton` saat loading → banner merah
  border saat error → empty state dengan CTA button. Ini konvensi yang sudah mapan — pola
  default untuk halaman list mana pun yang kamu sentuh.
- `tailwindcss-animate` sudah terpasang, dipakai untuk accordion + custom `voice-bar` keyframe
  (`tailwind.config.js:56-65`) — ada fondasi animasi ringan, belum dipakai luas.

### State yang belum diverifikasi langsung (cek begitu kamu pilih area kerja di §4.1)
- Validasi error inline di form skill picker (`AssessmentNewPage`/`EditPage`) — render tapi
  belum dites dengan input invalid.
- Responsive/mobile breakpoint di halaman assessor (semua halaman didesain lebar desktop
  `max-w-2xl`; belum dites di viewport sempit).
- Long-text overflow di evidence quotes / competency summary panjang di `PortfolioPage`.

### 2 arah visual (pilih di §4.5 — TIDAK dipilihkan di sini)
**Arah 1 — Polish minimal di atas pattern existing**
Terapkan pola Skeleton/error-banner/empty-CTA yang sudah ada secara konsisten ke titik yang
belum konsisten, rapikan rhythm spacing/typography, transisi halus pakai `tailwindcss-animate`
yang sudah terpasang. **Effort: rendah. Risiko: rendah.** Cocok kalau waktu mepet — tidak
menambah dependency, tidak menambah permukaan bug baru.

**Arah 2 — Lebih ekspresif dengan micro-interaction tambahan**
Tambah toast notification system (belum ada — perlu install `@radix-ui/react-toast` atau
setara), animasi state-transition pada coverage bar di `LiveMonitorPage`, crossfade
skeleton→content. **Effort: sedang. Risiko: sedang-tinggi** untuk sisa waktu ini — dependency
baru + permukaan interaksi baru berarti lebih banyak state untuk ditest dan discreenshot.
Nilai plus: lebih menonjol untuk kriteria "exceptional UI/UX design taste" di rubrik.

---

## Langkah 4 — Decision Gates

**Format: JANGAN aku isi. Pilih, lalu tulis alasan singkat di ruang kosong kalau perlu buat laporan PDF nanti.**

### 4.1 — Scope revamp final
✅ **DIPUTUSKAN (2026-08-18)** oleh Fadhil — dua bagian terpisah, bukan satu pilihan tunggal:

1. **A (F-01, P0) — mandatory security remediation.** Tenant isolation leak (`Portfolio`,
   `PortfolioSkill`, `FitGapReport`, `AssessorOverride` bisa diakses lintas tenant) **wajib
   ditutup sebelum submit**, terlepas dari narasi laporan — P0 nyata yang sudah dikonfirmasi
   di kode (`codebase-audit.md:363`) tidak etis dibiarkan cuma karena bukan fokus demo.
   Bukan bagian dari cerita produk utama; ini due-diligence.
2. **D + slice-C — primary product scope**, yang jadi fokus narasi laporan & demo:
   - **Finding D** (STEP 07): session lifecycle visibility — `started_at`/`ended_at`/
     `duration_seconds` sudah dihitung backend & dikirim API, tidak pernah dirender di
     frontend mana pun.
   - **Slice dari F-04/F-05** (bukan full Opsi C audit): AI-pipeline failure transparency —
     `portfolios.generation_error` sudah tersimpan & **sudah dikirim di response API**
     (`portfolios_controller.rb:20,169`, dikonfirmasi langsung ke kode) tapi
     `PortfolioPage.tsx:196` cuma render teks generik "Portfolio generation failed." tanpa
     pernah baca field itu. `TranscriptPage.tsx:82-86` sama — "No transcript available"
     generik, padahal `session.status` (pending/active/ended) sudah ada di response yang
     SAMA yang sudah di-fetch di komponen itu (`sessionsApi.get`, dipakai baris 23) — cukup
     untuk bedakan "belum mulai" vs "berakhir tapi transcript hilang" tanpa field baru.
   - **Temuan kunci saat verifikasi pra-implementasi**: kedua data ini **sudah 100% tersedia
     di response API yang sudah di-fetch** — scope 2 ini genuinely pure-frontend, nol
     perubahan backend/migration. Ini alasan kuat kenapa aman dikerjakan berdampingan dengan
     security fix (scope 1) tanpa context-switch backend↔frontend yang mahal.

**Eksplisit DI LUAR scope** (dicatat sadar, bukan lubang yang tidak disebut — untuk
"Problem & gap analysis" di laporan §Langkah 6):
- F-02 — retensi/penghapusan data kandidat (P0) — **tidak dikerjakan**. Alasan: waktu: fix
  yang genuinely aman (Sidekiq scheduled job + tombol delete) effort-nya **L** per audit
  Opsi E, tidak muat berdampingan dengan scope 1+2 dalam sisa waktu.
- F-03 — kebocoran channel B6 (P1) — **tidak dikerjakan**. Alasan: verifikasi butuh audio
  live real (schedule risk, `codebase-audit.md:412` sendiri menyebut ini risiko sedang-tinggi).
- F-04/F-05 sebagai **backend rework penuh** (verifikasi confidence scoring dari `probe_count`,
  prompt Gemini untuk narasi fit/gap) — **tidak dikerjakan**; hanya versi frontend-nya
  (transparency saat gagal) yang masuk lewat slice-C di atas.

- [x] F-01 — celah tenant isolation (P0) — mandatory fix, lihat poin 1
- [ ] F-02 — retensi/penghapusan data kandidat (P0) — out of scope, lihat catatan di atas
- [ ] F-03 — kebocoran channel B6 (P1) — out of scope, lihat catatan di atas
- [x] F-04/F-05 (slice, bukan penuh) — AI pipeline failure transparency — masuk lewat scope 2
- [x] Finding D (di luar audit) — session lifecycle visibility — masuk lewat scope 2

### 4.2 — Pendekatan teknis (Option A vs Option B)
🟡 **DIREKOMENDASIKAN AI (2026-08-18)** — hanya untuk sisi security fix (scope 1); sisi
scope 2 (D+slice-C) tidak butuh trade-off berarti karena murni rendering data yang sudah ada
(dikonfirmasi di §4.1 di atas). Fadhil bisa veto/ganti — ini bukan dikunci final, cuma supaya
implementasi bisa mulai tanpa nunggu ronde konfirmasi lagi mengingat sisa waktu.

**Konteks:** `Portfolio`/`PortfolioSkill`/`FitGapReport`/`AssessorOverride` tidak punya kolom
`tenant_id` sendiri (`schema.rb:59-131`) — beda dari `Assessment`/`Session`/`Vacancy` yang
sudah pakai `include TenantScoped` (concern yang butuh kolom `tenant_id` + default_scope,
lihat `api/app/models/concerns/tenant_scoped.rb`). Tenant sebenarnya bisa ditelusuri lewat
relasi: `Portfolio → session → tenant_id`, dst.

- **Option A — Scoping lewat join/relasi, TANPA migration.** Ganti lookup di
  `portfolios_controller.rb` (baris 82,104,130,156 per audit) dan `portfolio_skills_controller.rb`
  dari `Model.find(params[:id])` polos jadi query yang selalu lewat relasi tenant, mis.
  `Portfolio.joins(:session).merge(Session.where(tenant_id: Current.tenant_id)).find(...)`.
  **Effort: S. Risiko: Rendah** (tidak menyentuh schema/data existing, tidak ada backfill,
  tidak bisa merusak data). **Trade-off jujur**: tidak konsisten dengan pola `TenantScoped`
  yang sudah dipakai di 3 model lain — didokumentasikan sebagai known deviation, bukan
  disembunyikan, dengan alasan eksplisit: migration+backfill di <24 jam sisa waktu menaikkan
  risiko lebih dari nilai konsistensinya.
- **Option B — Kolom `tenant_id` + `TenantScoped` penuh (persis audit Opsi A asli).**
  Migration 4 tabel + backfill dari relasi + `include TenantScoped`. **Effort: M** (audit
  sendiri catat: "bootstrap RSpec dari nol... menambah waktu signifikan", `codebase-audit.md:396`).
  **Risiko: Sedang** — migration di tabel yang datanya sudah ada butuh backfill benar,
  bukan `null: false` langsung. Lebih konsisten & "proper" jangka panjang, tapi biaya waktu
  tidak sepadan untuk item yang bukan fokus narasi laporan (scope 1, bukan scope 2).
- **Dipilih: Option A** karena Contextual Fit menang jelas untuk sisa waktu <24 jam dan scope 1
  bukan bagian yang dinilai paling dalam di laporan (itu perannya scope 2) — spending effort M
  di sini mengambil jatah waktu dari scope 2 yang justru jadi fokus demo/rubrik utama.

### 4.3 — Struktur PR
✅ **DIPUTUSKAN** (sebelum handoff, di chat sebelumnya):
- [ ] Option A — satu PR komprehensif
- [x] Option B — Umbrella PR + sub-PR (dipisah backend/frontend/test)
- **Catatan eksplisit dari keputusan itu**: batas antar sub-PR JANGAN diturunkan dari bug-bug
  exploration (B-01..B-05) — harus mengikuti scope final §4.1 (C/A/B), yang baru jelas sekarang.

### 4.4 — Klaim kedalaman (backend-heavy vs frontend-heavy)
✅ **TERJAWAB dari §4.1** — hasilnya hybrid tapi condong jelas ke satu sisi:
- [ ] Backend-heavy
- [x] Frontend-heavy
- **Catatan:** scope 1 (security fix, Option A di §4.2) backend-only tapi kecil (Effort S,
  query-level fix di 2 controller). Scope 2 (D+slice-C, fokus laporan) **nol perubahan
  backend** — dikonfirmasi langsung ke kode: `started_at`/`ended_at`/`duration_seconds`
  (`sessions_controller.rb:152-177`) dan `generation_error` (`portfolios_controller.rb:20,169`)
  sudah dikirim di response API yang sudah di-fetch frontend, tinggal dirender. Klaim jujur:
  **frontend-heavy secara keseluruhan**, dengan satu sentuhan backend kecil & terpisah untuk
  security (bukan yang dinilai kedalamannya di laporan).

### 4.5 — Arah visual dari Langkah 3
🟡 **DIREKOMENDASIKAN AI (2026-08-18)** — Fadhil bisa veto, sama seperti §4.2:
- [x] Arah 1 — Polish minimal
- [ ] Arah 2 — Ekspresif dengan micro-interaction
- **Catatan:** scope 2 (§4.1) sudah menambah permukaan UI baru sendiri (timing display,
  error banner) — menumpuk Arah 2 (dependency `@radix-ui/react-toast` baru + animasi
  tambahan) di atasnya menaikkan risiko state-yang-perlu-ditest tanpa menambah nilai ke
  narasi laporan (yang soal AI-trust/observability, bukan micro-interaction). Arah 1 pakai
  pola Skeleton/error-banner/empty-CTA yang SUDAH ada persis untuk 2 komponen baru scope 2 —
  konsisten dengan codebase, effort rendah, risiko rendah.

---

## Langkah 5 — Timeline T-minus

Basis ~20 jam (sesuaikan proporsional kalau realitasmu 18 atau 24 jam — **JANGAN potong blok
tidur atau buffer submission, potong dulu blok test/screenshot kalau harus kompres**).

| Blok | Durasi | Kegiatan |
|---|---|---|
| T+0:00 → T+0:30 | 30 menit | Isi §4.1–§4.5 di atas. Blocker semua langkah berikutnya. |
| T+0:30 → T+1:00 | 30 menit | Self-derived acceptance criteria (per input & edge case: unassessed skills, missing ratings, model call failures, edge-case data types, long text) + draft cepat trade-off matrix Option A vs B — bisa mentah dulu, dirapikan nanti saat nulis laporan. |
| T+1:00 → T+7:00 | 6 jam | Implementasi backend module: data model (migration reversible!), endpoint, failure path (timeout, partial write, model error, duplicate job — brief minta ini eksplisit). |
| T+7:00 → T+11:00 | 4 jam | Implementasi frontend module: UI state sesuai arah visual §4.5, states loading/empty/error/partial/long-text/responsive. |
| T+11:00 → T+14:00 | 3 jam | Test harness: unit + integration yang BENAR-BENAR bisa gagal (nonton gagal dulu sebelum fix). **Seeded fault test**: rusak logic di scratch branch, buktikan test menangkap, revert dengan history kelihatan — WAJIB, ini item checklist eksplisit di brief. |
| T+14:00 → T+15:00 | 1 jam | Screenshot semua state penting (loading/error/empty/partial/responsive) — ambil sambil masih ingat konteksnya, jangan ditunda. |
| T+15:00 → T+15:45 | 45 menit | Rekam video demo 3-5 menit (Loom/YouTube unlisted/GDrive). |
| **T+15:45 → T+20:00** | **~4 jam** | **BLOK TIDUR — non-negotiable.** Live Technical Defense 45-60 menit dengan CTO & Tech Lead terjadi SETELAH deadline; kepala jernih di situ sama pentingnya dengan submit tepat waktu. |
| T+20:00 → T+22:00 | 2 jam | Tulis/rapikan laporan PDF — idealnya sudah 60-70% ter-draft paralel selama coding (jangan ditumpuk total di sini). Susun sesuai Report Checklist §6. |
| T+22:00 → T+22:30 | 30 menit | Review checklist disqualifier (§6) + baca ulang PR description. |
| T+22:30 → T+23:00+ | 30-60 menit | **Buffer submission** — upload PDF, cek link PR publik/accessible, cek link video bisa diputar tanpa login khusus. |

---

## Langkah 6 — Checklist Submission Final

### Requirement submission (brief §Step 6)
- [ ] Link GitHub PR — sesuai struktur §4.3, ke `github.com/rakamindev/ai-interview-platform`
- [ ] Product context analysis (users, kandidat, implikasi UU PDP) — draft dari Langkah 2 di atas
- [ ] Problem & gap analysis severity P0-P3 + constraint signal — dari `codebase-audit.md` §6
- [ ] Trade-off matrix Option A vs B — dari §4.2
- [ ] Acceptance criteria self-derived + edge case — dari Langkah 5 blok T+0:30
- [ ] Bukti test coverage + bukti seeded fault test + AI verification moment (minimal 1 contoh
      AI kasih kode salah/berisiko dan bagaimana kamu koreksi — **catat ini saat terjadi,
      jangan direkonstruksi di akhir**)
- [ ] Klaim kedalaman backend/frontend-heavy dinyatakan eksplisit — dari §4.4
- [ ] Screenshot semua state
- [ ] Video 3-5 menit, link eksternal

### 🚫 Reminder Disqualifier — cek SEBELUM submit, bukan sesudah
- [ ] Tidak ada test assertion yang dilemahkan/dihapus demi lolos
- [ ] Tidak ada secret/API key/data pribadi asli ter-commit — **cek khusus**: `api/config/application.yml`
      harus TETAP gitignored (jangan pernah `git add -f`), dan JANGAN commit `api/dump.rdb`
      kalau muncul lagi (artifact lokal dari Redis, sudah dibersihkan sekali di sesi ini)
- [ ] Tidak ada kode yang tidak bisa kamu jelaskan sendiri saat Live Defense
- [ ] Tidak cuma ditest happy path — edge case dari acceptance criteria §Langkah 5 harus ada buktinya
- [ ] Tidak mereproduksi pekerjaan kandidat lain tanpa atribusi
- [ ] UI/UX tidak diabaikan — evaluasi P0/P1 di rubrik brief eksplisit sebut ini bisa jadi disqualifier sendiri
