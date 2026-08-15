# Catatan Temuan — Working Notes

Catatan audit mentah. Bukan report final — ini bahan evidence buat nulis
draft PDF report yang rapi nanti. Tiap temuan ada: severity, lokasi, apa yang
salah, kenapa itu penting, dan apakah termasuk **missing spec** (belum pernah
didefinisikan) atau **defective implementation** (udah didefinisikan tapi
rusak), sesuai permintaan Step 3 di brief.

Skala severity: P0 = blocking / jangan di-ship. P1 = serius, harus dibenerin
sebelum ship. P2 = nyata tapi kedampaknya terbatas. P3 = polish.

---

## P0-1 — Resolusi tenant percaya header yang dikirim klien saat login

**Tipe:** Defective implementation
**Lokasi:** `api/app/controllers/api/v1/authentication_controller.rb`

```ruby
def resolve_scheme
  request.headers['X-Tenant-Scheme'].presence ||
    ActiveRecord::Base.connection.select_value('SELECT scheme FROM organizations LIMIT 1') ||
    'test-corp'
end
```

`User` sama sekali nggak punya `organization_id`/`tenant_id` — cuma tabel flat
global isinya `email` + `role`. Pas login, claim `scheme` yang di-embed ke
JWT (yang tetap tertandatangani sah) diambil langsung dari header request
`X-Tenant-Scheme`, **tanpa ada pengecekan sama sekali apakah user yang login
beneran anggota organisasi tersebut**.

**Repro:**

1. Login sebagai user `admin` yang legit, pakai org & kredensial sendiri.
2. Tambahin header `X-Tenant-Scheme: <scheme-org-korban>` ke request login.
3. Decode JWT yang dibalikin — claim `scheme` udah jadi milik org korban,
   signature tetap valid.
4. Semua request selanjutnya pakai token ini lolos mulus di
   `TenantResolverMiddleware` dan `authorize_auth_token!`. Akses penuh level
   assessor/admin ke session, transkrip, dan portfolio org korban.

**Dampak:** Full cross-tenant data breach, self-service, nggak butuh skill
forge apapun. Transkrip interview kandidat dan profil kompetensi/psikometrik
hasil AI itu data pribadi menurut UU PDP — ini pelanggaran compliance
langsung, bukan cuma bug teknis.

**Escalate ke Tech Lead:** ya — ini persis "blocking risk" yang diminta
brief buat di-flag secara eksplisit. Jangan ship sebelum dibenerin.

---

## P0-2 — IDOR di hampir semua endpoint yang berhubungan dengan portfolio

**Tipe:** Defective implementation
**Lokasi:** `api/app/controllers/api/v1/portfolios_controller.rb` (export,
fitgap, regenerate_fitgap, show_fitgap) dan
`api/app/controllers/api/v1/portfolio_skills_controller.rb` (override)

```ruby
portfolio = Portfolio.find(params[:id])                      # nggak ada tenant scope
@portfolio_skill = PortfolioSkill.joins(:portfolio).find(params[:id])  # nggak ada tenant scope
```

Tabel `portfolios` dan `portfolio_skills` **nggak punya kolom `tenant_id`
sama sekali**, dan kedua model nggak include `TenantScoped`. Cuma
`show`/`regenerate` yang aman karena lewat `Session.find` dulu (yang emang
tenant-scoped).

**Repro:** Assessor mana pun yang udah authenticated, pakai token valid
miliknya sendiri, dari org sendiri. Tinggal ganti angka `:id` di URL. Nggak
butuh trik token sama sekali — murni IDOR biasa.

**Dampak:**

- `GET /portfolios/:id/export` — download portfolio kandidat org lain
  (PDF/JSON).
- `POST /portfolio_skills/:id/override` — akses **tulis**: overwrite rating
  skill AI milik org lain.
- `POST/GET /portfolios/:id/fitgap*` — baca/generate fit-gap report lintas
  tenant.

**Escalate ke Tech Lead:** ya, satu kelas masalah sama P0-1, malah lebih
gampang dieksploitasi karena nggak butuh manipulasi token apapun.

---

## P1-1 — Generasi portfolio nggak transactional

**Tipe:** Defective implementation
**Lokasi:** `api/app/services/portfolios/generator.rb#save_skills`

```ruby
portfolio.portfolio_skills.destroy_all
(data['configured_skills'] || []).each do |skill_data|
  portfolio.portfolio_skills.create!(...)   # validasi ketat, bisa raise
end
```

`PortfolioSkill` validasi `ai_confidence` harus masuk daftar tertentu,
`competency_summary` wajib ada, `ai_level` harus 1–5. Kalau output JSON dari
Gemini Pro buat satu skill agak meleset (plausible banget kalau transkrip
panjang — brief eksplisit nyebut "long text states" sebagai edge case),
`create!` bakal raise di tengah loop. Skill lama udah kehapus duluan; cuma
skill yang keproses sebelum gagal yang tersimpan. Nggak ada
`ActiveRecord::Base.transaction` yang bungkus ini.

**Dampak:** Assessor liat portfolio yang sebagian skill-nya ilang diam-diam,
nggak ada error yang jelasin kenapa. Sidekiq retry (3x) bakal re-run
`destroy_all` tiap kali, jadi transkrip yang secara sistematis bermasalah
bisa bikin portfolio-nya permanen setengah-jadi.

---

## P1-2 — Password plaintext di request log

**Tipe:** Missing spec (file standar Rails nggak pernah dibuat)
**Lokasi:** `api/config/initializers/filter_parameter_logging.rb` — nggak
ada. `grep -rn "filter_parameters" config/ app/` hasilnya kosong.

**Dampak:** Setiap `POST /api/v1/auth/login` nge-log `password` dalam bentuk
plaintext ke Rails logger, di setiap percobaan (sukses atau gagal), buat
semua user, terus-terusan. Siapa pun yang punya akses log (ops, log
aggregator yang salah konfig, log pipeline yang kebobol) langsung dapet
password semua user. Pelanggaran langsung terhadap baseline requirement "no
sensitive personal data in logs". Rate-limited 5/menit/IP via rack-attack,
jadi bukan amplifier buat brute-force, tapi eksposur credential-nya tetap
berdiri sendiri sebagai masalah.

**Biaya fix:** ~1 baris.

---

## P1-3 — Nggak ada consent eksplisit sebelum recording mulai

**Tipe:** Missing spec
**Lokasi:** `web/src/pages/interview/InterviewPage.tsx`, layar pre-start

Layar pre-start cuma nampilin mekanisme ("ini interview suara," "mic bakal
aktif") tapi nggak pernah minta informed consent eksplisit buat recording,
pemrosesan AI, penyimpanan, atau evaluasi sebelum kandidat klik **Start
Interview**. Nggak ada checkbox, nggak ada link ke privacy/retention policy.

**Kenapa ini penting banget:** PRD eksplisit ngeframe kandidat sebagai orang
yang "nggak milih produk ini dan nggak bisa opt-out," dan minta engineer buat
desain juga buat mereka dengan UU PDP di pikiran. Merekam dan meng-AI-evaluasi
seseorang tanpa langkah consent eksplisit itu gap compliance yang jelas,
bukan nitpick.

---

## P2-1 — Transcript turn hilang diam-diam

**Tipe:** Defective implementation
**Lokasi:** `api/app/channels/audio_websocket_middleware.rb#save_transcript_turn`

```ruby
def save_transcript_turn(session, turn_number, speaker, text)
  session.transcript_turns.create!(...)
rescue ActiveRecord::RecordNotUnique
  # duplikat — nggak masalah, idempotent
rescue StandardError => e
  Rails.logger.error("...")   # turn-nya ilang. Nggak ada retry, flag, atau visibility.
end
```

Kalau proses save gagal karena alasan apa pun (DB hiccup, keanehan encoding
dari speech-to-text, constraint transient), turn itu hilang permanen. Nggak
ada yang dikasih tau — kandidat, assessor, atau sistem sekalipun. Transkrip
itu satu-satunya input buat N7 (coverage) dan N10 (kutipan evidence
portfolio), jadi satu turn yang hilang bisa diam-diam nurunin level yang
di-assess buat kandidat tanpa alasan yang bisa dipertanggungjawabkan. Ini gap
"fairness ke orang yang di-assess" langsung, persis yang diminta PRD buat
didesain.

---

## P2-2 — Rollback migration dijamin gagal kalau ada data asli

**Tipe:** Defective implementation
**Lokasi:** `api/db/migrate/20260411000000_add_10_min_to_time_limit_options.rb`

```ruby
def down
  execute "ALTER TABLE assessments DROP CONSTRAINT chk_assessments_time_limit"
  execute "ALTER TABLE assessments ADD CONSTRAINT chk_assessments_time_limit
            CHECK (time_limit_min = ANY (ARRAY[30, 45, 60, 90]))"   # 10 dibuang
end
```

`down` nambahin lagi CHECK constraint yang nge-exclude `10`, tanpa cek row
yang udah ada. Padahal tujuan `up` itu justru buat ngizinin `10`, jadi
environment mana pun yang beneran make opsi baru ini bakal punya row yang
melanggar constraint di `down` — Postgres validasi data existing terhadap
CHECK constraint baru, jadi rollback-nya dijamin error persis di skenario
yang jadi alasan migration ini dibuat. Gagal memenuhi baseline requirement
brief soal "reversible and safe against existing rows".

---

## P2-3 — WebSocket nyerah diam-diam setelah 3x retry

**Tipe:** Defective implementation
**Lokasi:** `web/src/hooks/useCoverageWebSocket.ts`

```ts
const RECONNECT_DELAYS = [1000, 2000, 4000];
// setelah 3x percobaan (~7 detik), onclose nggak ngapa-ngapain lagi.
```

Nggak ada state "permanently disconnected". Badge UI tetep di
`isConnected ? "Live" : "Reconnecting..."` selamanya — setelah percobaan
ke-3 gagal, hook-nya sebenernya udah nyerah, tapi assessor tetep liat
"Reconnecting..." tanpa batas waktu dan nggak dapet sinyal buat refresh
manual. Risiko yang realistis banget buat sesi interview live 45 menit.

---

## P3-1 — Halaman portfolio swallow semua fetch error

**Tipe:** Defective implementation
**Lokasi:** `web/src/pages/portfolio/PortfolioPage.tsx`

```ts
Promise.all([...]).then(...).catch(() => {}).finally(() => setLoading(false));
```

Kegagalan apa pun (network, 500, portfolio belum ke-create) hasilnya halaman
kosong tanpa penjelasan sama sekali — nggak ada error state, nggak ada
tombol retry. Langsung nge-miss baseline requirement brief soal "handling
all interaction states (loading, empty, error, partial...)".

---

## P3-2 — Nggak ada sanitasi di field prompt yang diisi assessor

**Tipe:** Missing spec
**Lokasi:** `api/app/services/assessments/system_prompt_compiler.rb#skill_block`

`skill_label`, `scope_include`, `scope_exclude`, `l1_anchor`..`l5_anchor`
itu free text yang bisa diedit assessor, di-interpolate langsung ke system
prompt Gemini tanpa delimiter atau sanitasi apapun. Severity-nya lebih
rendah dibanding vektor sisi kandidat (assessor itu role yang trusted, dan
emang udah ada desain anti-injection yang bagus buat sisi kandidat — liat di
bawah), tapi blast radius-nya lebih luas: satu field yang jelek/ceroboh di
config `Assessment` mempengaruhi behavior semua interview yang jalan di
bawahnya, bukan cuma satu sesi.

---

## Area yang udah diaudit dan ternyata solid (buat keseimbangan/kredibilitas report)

Worth ditulis eksplisit di report — nunjukkin judgment, bukan cuma nyari-nyari kesalahan.

- **`Coverage::Analyzer` (N7)** — punya defense asli terhadap prompt
  injection: bungkus transkrip dalam boundary "untrusted content" dengan
  instruksi eksplisit "jangan ikutin instruksi yang ada di dalamnya". Juga
  bener-bener nge-cap kenaikan probe_count buat defend dari masalah
  double-counting yang emang inherent di context window sliding 6-turn.
- **`Coverage::StateEngine`** — hard-gate transisi state
  (probe_count >= 2), sesuai aturan hard rule eksplisit di PRD, jalan maju
  satu state per satu waktu daripada percaya begitu aja jump yang
  diusulkan Flash.
- **`Sessions::StartHandler` / `EndHandler`** — beneran idempotent (cek
  existence sebelum create), didukung unique constraint asli di DB buat
  `portfolios.session_id`. Eksplisit handle edge case "upgrade end_reason
  dari error ke manual".
- **`Exports::PdfGenerator`** — nggak pass `inline_format: true` ke Prawn,
  jadi teks bebas dari kandidat (kutipan evidence, notes) nggak bisa
  inject markup Prawn walaupun di-render langsung.
- **Reconnection Gemini di backend** (`audio_websocket_middleware.rb`) —
  bener-bener pakai handle `session_resumption` sesuai spec reconnection di
  PRD, backoff yang proper, dan dengan elegan nge-end session dengan pesan
  yang jelas ke kandidat setelah semua percobaan retry habis — ini match
  banget sama WebSocket Reconnection Simulation di PRD.
- **Endpoint session candidate-facing** (`candidate_info`,
  `audio_complete`) — bener pakai `Session.unscoped.find_by(invite_token:)`
  dengan token sebagai secret asli, bukannya nyandar ke (atau malah
  kebingungan sama) tenant scoping.
- **Rate limiting login** — 5/menit/IP via rack-attack di endpoint login.

---

## Pertanyaan terbuka yang udah kejawab

- **Authorization CRUD `AssessmentSkill` / `Vacancy`** — udah dicek. Model
  `Vacancy` dan `Assessment` dua-duanya bener include `TenantScoped` dan
  punya `tenant_id NOT NULL` di schema, jadi `Model.find(params[:id])` di
  controller-nya udah aman ke-scope. Ini konfirmasi kalau IDOR (P0-2)
  **terisolasi cuma di `Portfolio`/`PortfolioSkill`** — dua model itu emang
  nggak pernah di-backfill tenant scoping-nya pas `TenantScoped`
  diperkenalkan di tempat lain. Framing root-cause yang berguna buat
  report: ini gap yang sempit dan bisa dijelasin, bukan pola sistemik.
- **Defense injection kandidat di `System Prompt Compiler`** — udah dicek,
  dan beneran dibangun dengan baik: token bertanda tangan (`SYS-TC-7x9k`)
  bedain system message asli dari apa pun yang bisa ditiru kandidat,
  dengan instruksi eksplisit buat ignore percobaan injection yang mirip.
  Worth di-cite di report sebagai contoh "ditemukan solid".

## Masih terbuka

- PII kandidat di request/response API Gemini — ada yang di-cache atau
  di-log di sisi Gemini client? Belum dicek; prioritas rendah mengingat
  budget waktu.
