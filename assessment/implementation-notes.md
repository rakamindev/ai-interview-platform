# Catatan Implementasi (Step 5)

Log kerja pas eksekusi tiap sub-PR di [revamp-strategy.md](revamp-strategy.md).
Diisi berjalan pas ngoding, bukan direkonstruksi belakangan — biar detail AI
verification & bukti test gak ke-lupa pas nyusun PDF final.

## Link PR

| Sub-PR | Link |
|---|---|
| 1. Tenant Isolation Hardening | https://github.com/rakamindev/ai-interview-platform/pull/6 |
| 2. Not-Assessed Skill State | https://github.com/rakamindev/ai-interview-platform/pull/7 |
| 3. Candidate-Facing Error State | https://github.com/rakamindev/ai-interview-platform/pull/8 |
| 4. Hardware Check Reliability | https://github.com/rakamindev/ai-interview-platform/pull/9 |
| Bonus: Auth & Session Hardening (P1-4/5/6) | https://github.com/rakamindev/ai-interview-platform/pull/10 |
| Bonus 2: Invite Link Wrong Origin (P0-6) | https://github.com/rakamindev/ai-interview-platform/pull/11 |
| Sub-PR 5: UI/UX Polish | https://github.com/rakamindev/ai-interview-platform/pull/12 |
| Bonus 3: Organization Hardening + candidate_name | https://github.com/rakamindev/ai-interview-platform/pull/13 |

---

## Sub-PR 1: Tenant Isolation Hardening

- [x] Migration ditulis + di-test reversible (`rails db:rollback` lalu `db:migrate` lagi, schema balik sama, backfill re-run bersih)
- [x] Kode fix — `include TenantScoped` di `Portfolio`, `PortfolioSkill`, `AssessorOverride`, `CoverageMap`, `TranscriptTurn`, `FitGapReport`. **Controller-nya sendiri gak disentuh sama sekali** — `Portfolio.find`/`PortfolioSkill.find` otomatis ke-scope lewat `default_scope`, dan tiap call site udah punya `rescue ActiveRecord::RecordNotFound` yang balikin 404. Root-cause fix beneran nutup di 1 titik (model), bukan tambal 4 controller action.
- [x] Test ditulis, dijalanin, ijo — 33 example (6 model spec pola tenant-scoping via shared example + 2 request spec buktiin IDOR ketutup di endpoint asli: `export`, `fitgap`, `regenerate_fitgap`, `show_fitgap`, `portfolio_skills#override`)
- [x] Seeded fault test: branch `scratch/seeded-fault-tenant-isolation` — commit `ee4360e` cabut `include TenantScoped` dari `Portfolio`, jalanin test → **25/33 gagal** (model spec + request spec IDOR-nya persis merah). Revert via `git revert ee4360e` (commit `6c088d4`) → 33/33 ijo lagi. Kedua commit itu kesimpen di history branch scratch, gak di-squash.
- [x] Screenshot: lihat log run RSpec di atas (gagal → revert → ijo) — buat PDF ambil dari transcript sesi ini, belum ada screenshot terpisah.

### AI Verification Moment
Implementasi pertama gue tulis `self.tenant_id ||= session&.tenant_id` di tiap
model (pakai `||=` biar konsisten sama pola default `TenantScoped`). Kelihatan
benar secara inspeksi kode. Tapi pas dijalanin di RSpec, 6 test "excluded from
different tenant" gagal — hasil query nunjukin `tenant_id` record baru sama
dengan `Current.tenant_id` yang gue set di test, bukan tenant asli dari
session-nya.

Root cause (ketauan cuma dari run test, gak kelihatan dari baca kode): Rails
punya fitur "scope attribute pre-population" — `Model.new` otomatis ngisi
attribute dari kondisi equality di `default_scope` yang lagi aktif
(`where(tenant_id: Current.tenant_id)`) **sebelum** `before_validation`
sempat jalan. Jadi `self.tenant_id ||= session&.tenant_id` selalu no-op
karena `tenant_id` udah "keisi" duluan (dari `Current`, sumber salah) pas
`assign_tenant_id` baru mulai jalan.

Fix: ganti `||=` jadi `=` biar turunan dari parent (session/portfolio) selalu
menang, gak peduli udah keisi duluan atau belum. Ini bug yang murni AI
(gue) yang nulis salah dan cuma ketauan gara-gara nulis+jalanin test — kalau
cuma review kode manual tanpa run test, ini bakal ke-ship sebagai "root-cause
fix" yang sebenarnya masih bolong persis di IDOR yang mau ditutup.

### Catatan lain
- Data dev/test kosong pas migration jalan pertama kali — backfill gak bisa
  diverifikasi manual by-eye, jadi RSpec beneran satu-satunya cara valid buat
  nge-prove behavior-nya bener (bukan sekadar formalitas checklist).
- Ada polusi kecil di `rakamin_test` DB dari eksperimen debug manual pakai
  `rails runner` (gak transactional, gak ke-rollback) — sempet bikin 1 test
  gagal karena `UniqueViolation` di scheme organization, bukan bug beneran.
  Dibersihin via `TRUNCATE ... RESTART IDENTITY CASCADE`. Pelajaran: jangan
  debug pakai `rails runner` langsung ke `rakamin_test`, pakai `rails console
  -e test` di transaction block atau db terpisah kalau perlu lagi.


---

## Sub-PR 2: Not-Assessed Skill State

- [x] Migration — tambah enum `portfolio_skill_status` (`assessed`/`not_assessed`/`unparseable`) ke `portfolio_skills`, `ai_level`/`ai_confidence` jadi nullable. Reversible (`db:rollback` dites di DB test), `down` sengaja gak restore NOT NULL constraint biar aman dijalanin kapan pun (bukan cuma langsung setelah `up`).
- [x] Kode fix backend — `Portfolios::Generator#save_skills` sekarang iterate skill yang **dikonfigurasi assessment**, bukan cuma yang Gemini balikin. Tiap skill dapet row eksplisit: `assessed` (level valid), `not_assessed` (Gemini gak nyebut sama sekali), `unparseable` (disebut tapi level-nya gak bisa diparse — bukan didefault ke skor terendah). `PdfGenerator` & JSON serializer nampilin status eksplisit.
- [x] Kode fix frontend — `SkillPortfolioCard` branch di 3 status: assessed (badge level normal), not_assessed (card muted, "—"), unparseable (card amber, "⚠ Needs manual review"). `parseLevel()` gak lagi default ke 1 pas gagal parse — balikin `null`, dipaksa caller nangani eksplisit. Override panel disembunyiin buat skill yang gak assessed (gak ada skor AI buat dikoreksi).
- [x] Test: 16 RSpec (model, `Portfolios::Generator`, `FitGap::Engine`) + 13 Vitest (baru dipasang dari nol — `web/` sebelumnya belum ada test runner sama sekali) buat `parseLevel` + `SkillPortfolioCard` 3 state + regresi crash.
- [x] Seeded fault test: branch `scratch/seeded-fault-not-assessed-skill` — balikin `parse_level` ke `raw.to_i.clamp(1,5)` (bug lama), 1/16 RSpec merah (persis test "unparseable instead of lowest score"), revert via `git revert`, ijo lagi.
- [x] Screenshot: dari transcript sesi + output test di atas, belum ada capture terpisah.

### AI Verification Moment
Setelah nulis fix `Portfolios::Generator`, gue trace manual semua caller
`portfolio_skills`/`ai_level`/`effective_level` sebelum nganggep perubahan
ini kelar (bukan nunggu ketauan dari test doang kali ini). Ketemu:
`FitGap::Engine#build_skill_comparisons` asumsi "kalau `portfolio_skill`
ketemu, pasti ada level-nya" — `candidate_level - expected_level` bakal
`nil - Integer` dan crash, karena sekarang **setiap** skill yang
dikonfigurasi selalu punya row (dulu skill yang gak ke-assess ya gak ada
row-nya sama sekali, jadi `find_portfolio_skill` balikin nil dan masuk
`else` branch yang aman).

Ini murni konsekuensi gak keliatan dari perubahan gue sendiri — bukan bug
lama, tapi bug BARU yang bakal gue introduce kalau gak nge-grep pemakai
lain dari kolom yang gue ubah maknanya. Fix: `FitGap::Engine` sekarang
treat "row ketemu tapi level null" sama kayak "row gak ketemu" — dua-duanya
`result: 'not_assessed'`. Ada test spesifik (`fit_gap/engine_spec.rb`)
yang nge-assert ini gak crash, judulnya eksplisit nyebut ini regresi dari
perubahan Sub-PR 2.

### Catatan lain
- Vitest sempet gagal 2x pas run pertama: (1) file sampah AppleDouble
  (`._*.test.ts`) ke-scan sebagai test file beneran di exFAT drive —
  solusi: bersihin `._*` sebelum tiap run (udah dicatet di AGENTS.md).
  (2) `localStorage.getItem is not a function` — Node 25 punya native
  `localStorage` eksperimental yang bentrok sama punya jsdom. Fix: force
  polyfill in-memory di `src/test/setup.ts`, bukan app bug.

---

## Sub-PR 3: Candidate-Facing Error State

- [ ] Kode fix (frontend)
- [ ] Test
- [ ] Seeded fault test
- [ ] Screenshot

### AI Verification Moment

### Catatan lain

---

## Sub-PR 4: Hardware Check Reliability

- [x] Endpoint baru di api/ — `GET /api/v1/speed_test/download` (proc route, 500KB payload tetap, gak butuh auth, gak butuh controller — pola sama kayak `POST /speed_test` upload yang udah ada duluan). Ditambah throttle 20/menit/IP di `rack_attack.rb` (endpoint pre-session, unauthenticated, butuh limit sendiri).
- [x] Kode fix backend — cuma endpoint baru di atas, gak ada perubahan lain.
- [x] Kode fix frontend — `internetSpeedTest.ts` ditulis ulang: default ping/download/upload sekarang ke backend sendiri (`API_BASE_URL` di-export dari `services/api.ts`), bukan `httpbin.org`/jsdelivr/unpkg lagi. Kalau semua pengukuran gagal total → `status: "inconclusive"` (bukan angka fallback fiktif). Kalau sebagian doang yang gagal → tetep `inconclusive`, bukan `failed` (data gak lengkap gak layak dipake buat nge-fail kandidat). `ProctoringState` tambah `WARNING` — hasil inconclusive gak ngeblok `allPassed` (beda dari `ERROR` yang beneran ngeblok "Start Interview").
- [x] Test — 2 RSpec (endpoint download ukurannya bener + no-auth, endpoint upload lama tetep jalan) + 3 Vitest (`testInternetSpeed`: semua gagal → inconclusive+null, semua sukses → passed, sebagian doang sukses → tetep inconclusive bukan failed).
- [x] Seeded fault test: branch `scratch/seeded-fault-hardware-check` — balikin logic "semua gagal" ke return angka fallback lama (`0.5`), test inconclusive merah, revert, ijo lagi.
- [x] Screenshot: dari transcript sesi + output test, belum ada capture terpisah. Endpoint baru juga udah diverifikasi manual via `curl` ke server dev yang lagi jalan (200, size persis 500000 byte).

### AI Verification Moment
Awalnya gue mau bikin status cuma `passed`/`failed` (boolean lama diganti union
2 nilai doang). Tapi pas nulis logic "kalau sebagian metric gagal diukur"
(misal ping berhasil tapi download/upload gagal semua — kondisi realistis
kalau ada 1 dari 2 endpoint kena rate-limit/network hiccup sesaat), sadar
kalau data separuh itu **gak cukup buat bilang koneksi kandidat jelek** —
motong kandidat berdasarkan setengah data itu sama salahnya kayak bug asli
(P0-5) yang lagi diperbaiki. Ganti jadi 3 status (`passed`/`failed`/
`inconclusive`), dan `inconclusive` jadi default kalau pengukurannya gak
lengkap, bukan cuma kalau semuanya gagal total. Ada test spesifik
("returns inconclusive rather than failed when only some metrics could be
measured") yang mastiin distinction ini beneran jalan, bukan cuma niat di
komentar.

### Catatan lain
- Endpoint `speed_test/download` sengaja proc route polos (bukan
  controller), ngikutin pola persis endpoint upload yang udah ada — gak
  butuh auth/tenant karena dipanggil sebelum kandidat punya session/JWT.
- `env`-var override (`VITE_SPEED_TEST_PING_URL` dkk) tetep dihormatin
  kalau ada yang mau pakai endpoint lain — cuma defaultnya diganti dari
  kosong (jatuh ke pihak ketiga) jadi backend sendiri.

---

## Bonus (P1): Auth & Session Hardening (P1-4, P1-5, P1-6)

- [x] Migration — 1 baru: `add_column :users, :active, :boolean, default: true, null: false` (P1-5). Reversible, di-test rollback+migrate ulang bersih. P1-4 gak butuh migration (reuse `created_at`).
- [x] Kode fix:
  - P1-6: hapus fallback `VITE_DEV_TOKEN` dari `authAtom.ts#getStoredToken()`. Bersihin dokumentasi env var yang udah gak kepake (`web/.env.example`, `web/README.md`).
  - P1-4: `Session#invite_expired?` (`pending? && created_at < 7.days.ago`), dicek di `candidate_info` + `audio_complete` → `410 Gone` kalau expired.
  - P1-5: `AuthorizeApiRequest#account_active?` — cek kolom `active` di `users`, di-cache `Rails.cache` 60 detik, **scoped ke role `admin` doang** (role `assessor` dari app sister gak ada di tabel lokal, lihat Constraint Signal #6 di gap-analysis.md).
- [x] Test — 3 Vitest (`authAtom`: no fallback ke env var, token asli tetep jalan, clear abis logout) + 11 RSpec (4 `Session#invite_expired?`, 4 request spec candidate invite expiry, 3 request spec account revocation termasuk regression check buat role `assessor`).
- [x] Seeded fault test: 3 branch scratch terpisah (`scratch/seeded-fault-dev-token-bypass`, `scratch/seeded-fault-invite-expiry`, `scratch/seeded-fault-account-revocation`) — tiap satu balikin 1 fix ke kondisi bug, test yang bersangkutan merah, revert via `git revert`, ijo lagi.
- [x] Screenshot: dari transcript sesi + output test.

### AI Verification Moment
Rencana awal P1-5: cek `active` user via query DB langsung tiap request
(paling simpel). Tapi pas mau nulis, ke-inget `AuthorizeApiRequest` punya
komentar eksplisit "Does NOT hit the database for user lookup — trusts the
JWT claims" — itu keputusan desain sengaja, bukan kelalaian. Investigasi
lebih lanjut ke `AuthenticationController`/`User` model nemuin fakta penting:
tabel `users` di app ini **cuma buat akun admin lokal** — role `assessor`
via `ASSESSOR_ROLES = %w[admin assessor]` diterbitin app sister
`rakamin-api` (JWT dipakai bareng, `SECRET_KEY_BASE` sama), dan akun
`assessor` itu **gak ada row-nya di tabel `users` app ini sama sekali**.

Kalau gue asal query `User.find(user_id)` tanpa nyadar ini, kode bakal
korban 2 arah: (1) kalau `id` gak ketemu di tabel lokal, query gagal/return
nil, harus diputusin gimana treat-nya — kalau salah putusan (misal anggap
"gak ketemu = ditolak"), **semua token `assessor` dari app sister bakal
ke-block**, regresi besar yang blocking fitur yang emang lagi "planned"; (2)
kalaupun `nil` di-anggap "boleh lewat" buat aman, itu sama aja gak ngecek
apa-apa buat kasus assessor. Fix: scope pengecekan `account_active?` cuma
buat `role == 'admin'`, biarin role lain lewat tanpa disentuh — precise
fix, bukan defensive-tapi-salah. Ada test spesifik ("does not affect
assessor-role tokens...") yang mastiin ini.

Verifikasi kedua: nebak `ExceptionHandler::Unauthorized` bakal ngasih HTTP
401 (nama exception-nya emang "Unauthorized"). Test gagal, actual-nya 403.
Baca `exception_handler.rb` langsung: exception ini sengaja di-map ke 403
(dianggap "authenticated tapi gak diizinkan," bukan "gak keautentikasi
sama sekali") — konsisten sama gimana `check_role!` yang udah ada
berperilaku. Ganti ekspektasi test, bukan paksa app-nya ngikutin asumsi
awal yang salah.

### Catatan lain
- `Rails.cache` di test env pake `:null_store` (liat
  `config/environments/test.rb:24`) — artinya cache 60-detik P1-5 **gak
  pernah kejadian pas test**, tiap fetch selalu fresh dari DB. Behavior
  staleness-nya sengaja gak dites otomatis (susah dites deterministik
  tanpa mocking waktu/cache backend) — cukup diverifikasi lewat kode +
  reasoning di revamp-strategy.md.
- P1-1, P1-2, P1-3 tetep gak digarap — investigasinya belum sedalam 3 ini,
  didokumentasiin di gap-analysis.md sebagai deferred.

---

## Bonus 2: Invite Link Wrong Origin (P0-6)

- [x] Kode fix: `Session#invite_url` ganti dari `APP_BASE_URL` ke
  `FRONTEND_BASE_URL` (baru, default `http://localhost:5173`). Update
  `api/README.md` + `application.yml.sample` biar beda fungsi 2 env var
  itu jelas.
- [x] Test — 2 RSpec (`invite_url` pake `FRONTEND_BASE_URL` kalau di-set;
  default ke Vite dev server kalau gak di-set).
- [x] Seeded fault test: branch `scratch/seeded-fault-invite-url-origin` —
  balikin ke `APP_BASE_URL`, test merah, revert, ijo lagi.
- [x] Screenshot: dari transcript sesi (bukti manual "Copy link" ngasih
  Rails routing error sebelum fix).

### AI Verification Moment
Ini kebalikan dari kebanyakan temuan lain di case study ini — bukan gue
yang nemuin lewat baca kode/audit, tapi user yang nemuin lewat **manual
testing beneran** ("Copy link" terus dibuka di browser, kena Rails
Routing Error). Itu persis alasan brief minta "test end-to-end di
browser, bukan cuma baca kode" — bug ini gak keliatan dari code review
biasa karena kodenya "valid" secara sintaks, cuma env var-nya salah
sasaran secara semantik (butuh tau `APP_BASE_URL` didokumentasiin buat apa
vs dipake buat apa, gak ketauan tanpa nyoba beneran).

### Catatan lain
- Dikerjain di `git worktree` terpisah (`/tmp/invite-url-fix`), bukan di
  working directory utama — biar gak ganggu kerjaan AI lain yang lagi
  aktif ngedit banyak file `web/` di working directory yang sama pas itu.

---

## Test Coverage — Ringkasan Akhir

<!-- diisi pas semua sub-PR kelar: command yang dijalanin, hasil, coverage kalau ada -->

---

## Bonus 3: Organization schema-qualification + candidate_name

- [x] Kode fix — `Organization.table_name = 'public.organizations'`
  (eksplisit, bukan lagi ngandelin urutan `search_path`). `candidate_info`
  endpoint nambah field `candidate_name` di response.
- [x] Test — 5 RSpec: `Organization.table_name` di-pin ke nilai
  eksplisit, `.identify` nemuin org asli by scheme, **`.identify` tetep
  bener sekalipun ada tabel decoy `ai_interview.organizations`** (simulasi
  langsung skenario bahaya via raw SQL di test, bukan cuma pin nilai),
  `candidate_info` nyertain `candidate_name` kalau ada, dan tetep nyertain
  key-nya (null) kalau kosong — bukan diilangin diam-diam.
- [x] Seeded fault test: branch `scratch/seeded-fault-organization-schema`
  — balikin `table_name` ke `'organizations'` polos, test decoy-table
  merah, revert, ijo lagi.

### AI Verification Moment
Godaan pertama: nulis test cuma nge-pin `table_name == 'public.organizations'`
doang (gampang, tapi gak beneran ngebuktiin APA yang salah kalau reverted).
Sadar itu test yang lemah — dia bakal ijo dulu, tapi gak pernah nunjukin
skenario bahaya asli, cukup bikin regresi lain di masa depan (misal
typo di value string) yang lolos kalau assertion-nya cuma exact-match
tanpa konteks. Ganti jadi test yang beneran simulasiin insiden yang
kejadian hari ini: bikin tabel decoy kosong di `ai_interview.organizations`
lewat raw SQL di dalem test, terus buktiin `.identify` tetep nemuin
organisasi asli. Test ini yang beneran gagal kalau fix-nya di-revert
(dibuktiin lewat seeded fault test), bukan cuma "pura-pura merah."

### Catatan lain
- Bug 403 ini murni gara-gara insiden DB lokal (drop/recreate schema
  `ai_interview` gak sengaja pas debugging invite_url tadi) — bukan bug
  yang bakal muncul di fresh clone/migrate manapun. Fix `table_name`-nya
  tetep worth dipertahanin sebagai hardening, tapi jangan salah paham ini
  "bug produksi yang selama ini ada" — itu gak akurat.

## Claimed Engineering Depth

<!-- backend-heavy vs frontend-heavy, jujur porsi mana yang paling dalam digarap -->
