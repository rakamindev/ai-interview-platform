# Revamp Strategy

## Pendekatan: Umbrella PR

Brief kasih 2 opsi struktur PR (Section "Pull Request Options"). Gue pilih
**Option B: Umbrella PR** — 1 PR visi besar, linked ke sub-PR fokus per gap.
Alasan: 4 gap yang digarap (dari 5 temuan P0 di [gap-analysis.md](gap-analysis.md),
P0-1+P0-2 digabung jadi 1 karena akar masalahnya sama) punya root cause dan area
kode yang beda-beda — nyampur jadi 1 PR raksasa bikin reviewer susah nge-trace
"kenapa baris ini berubah" balik ke gap mana, dan susah di-revert parsial kalau
salah satu ternyata bermasalah. Tiap sub-PR dapet AC + trade-off + test sendiri,
biar kedalaman analisisnya gak keencerin gara-gara dipecah banyak.

Urutan pengerjaan (yang paling berisiko/paling nyakitin kandidat duluan):
1. Tenant Isolation Hardening (P0-1, P0-2)
2. Not-Assessed Skill State (P0-4)
3. Candidate-Facing Error State (P0-3)
4. Hardware Check Reliability (P0-5)
5. *(Opsional, ringan, di luar scope P0)* UI/UX & Form Validation Polish

---

## Sub-PR 1: Tenant Isolation Hardening (P0-1, P0-2)

**Root cause**: `Portfolio`, `PortfolioSkill`, `AssessorOverride`, `CoverageMap`,
`TranscriptTurn`, `FitGapReport` gak punya kolom `tenant_id` dan gak ikut concern
`TenantScoped` — beda dari `Assessment`/`Session`/`Vacancy` yang udah bener. 4
controller action ketauan bypass rantai scoping ini (lihat gap-analysis.md P0-1/P0-2).

### Acceptance Criteria
- Given assessor tenant A login sah, When akses `GET /portfolios/:id/export`,
  `/fitgap`, `/regenerate_fitgap`, `/show_fitgap`, atau `POST
  /portfolio_skills/:id/override` buat portfolio/skill milik tenant B, Then
  response `404 Not Found` (bukan `403` — jangan bocorin bahwa record-nya ada).
- Given portfolio yang session/assessment induknya udah kehapus (orphan, kalau
  ada), When resolve tenant, Then dianggap gak ditemuin (404) — jangan crash,
  jangan defaultin ke tenant siapapun.
- Given migration backfill `tenant_id` jalan di data production existing, When
  ada row yang gak bisa di-resolve tenant-nya (parent hilang), Then row itu
  ditandain/dilaporin (log/report terpisah), bukan diem-diem di-skip atau
  di-set tenant sembarangan.
- Given endpoint yang sama diakses assessor tenant yang bener, When request
  valid, Then behavior gak berubah sama sekali (regression check).

### Option A — Denormalize `tenant_id` + pasang `TenantScoped`
Tambah kolom `tenant_id` ke `portfolios`, `portfolio_skills`,
`assessor_overrides`, `coverage_maps`, `transcript_turns`, `fit_gap_reports`.
Migration: tambah kolom nullable dulu → backfill dari
`session.assessment.tenant_id` → baru pasang `NOT NULL` + index kalau backfill
bersih. Include `TenantScoped` di semua model itu, sama kayak `Assessment`.

- **Product impact vs cost**: Fix di 1 tempat (`default_scope` di concern),
  semua controller yang ada maupun yang bakal ditulis nanti otomatis aman —
  gak nunggu manusia inget nambahin filter tenant tiap bikin endpoint baru.
  Cost: migration nyentuh tabel yang udah ada data-nya (butuh backfill query
  yang bener, path 3-level join `portfolio → session → assessment`).
- **Maintainability**: Tinggi — pola udah ada dan kepake bener di 3 model lain,
  developer baru yang liat kode ini gampang connect the dots.
- **Failure mode**: Backfill bisa gagal buat row orphan (session/assessment
  udah kehapus) — mesti eksplisit ditangani (laporan terpisah), bukan silent.
- **Contextual fit**: Ini persis constraint signal yang gue tulis di
  gap-analysis.md — "pola parent-chain itu rapuh by design, udah kebukti
  gagal dua kali." Fix akar masalah > tambal per-endpoint.

### Option B — Scope manual per-controller lewat join
Gak ubah schema. Tiap controller action yang kena, ganti `Model.find(id)` jadi
`Model.joins(session: :assessment).where(assessments: {tenant_id:
Current.tenant_id}).find(id)`.

- **Product impact vs cost**: Murah, cepet, gak ada migration, review-nya kecil.
- **Maintainability**: Rendah — ngandelin tiap developer nanti inget nulis
  join yang sama persis. Bug ini sendiri kejadian karena pola ini (implisit,
  ngandelin ingatan manusia) gagal di 2 controller berbeda.
- **Failure mode**: Risiko reintroduce bug yang sama kalau ada controller baru
  buat resource ini — gak ada guardrail dari framework/compiler.
- **Contextual fit**: Cepet buat nutup lubang sekarang, tapi gak nyelesain akar
  masalahnya — cuma nambal 4 titik yang ketauan hari ini, titik lain (yang
  belum ketauan) tetep rentan.

**Keputusan: Option A.** Ini kerentanan keamanan yang bocor PII kandidat asli
lintas tenant — layak investasi lebih di root-cause fix, bukan tambal cepat.
Cost migration diterima karena severity P0.

---

## Sub-PR 2: Not-Assessed Skill State (P0-4)

**Root cause**: Backend nge-clamp `level` yang hilang jadi skor 1 (lowest),
bukan nandain "belum dinilai" — dan frontend gak pernah nyocokin skill yang
dikonfigurasi assessor vs skill yang beneran muncul di hasil.

### Acceptance Criteria
- Given skill dikonfigurasi assessor tapi Gemini gak pernah nyebut sama sekali
  di response akhir (sesi kepotong waktu/di-end manual), When portfolio
  digenerate, Then skill itu dapet row eksplisit `status: not_assessed` dengan
  `level: nil` — bukan diem-diem absen dari tabel.
- Given skill yang Gemini sebut tapi field `level`-nya hilang/`null`/tipe aneh,
  When parsing response, Then ditandain `status: unparseable` (bukan otomatis
  jadi skor 1), dan dicatat buat investigasi (bukan silent).
- Given skill dengan `level` valid (1-5, termasuk format aneh kayak `"3
  (Intermediate)"`), When parsing, Then hasilnya level yang bener, gak keganggu
  perubahan di atas.
- Given skill discovered (di luar rencana) dengan level valid, When
  ditampilin, Then tetep normal kayak sekarang.
- Given laporan PDF export, When ada skill `not_assessed`/`unparseable`, Then
  PDF juga nampilin state itu eksplisit (`"Belum Dinilai"` / `"Perlu Ditinjau
  Manual"`) — bukan cuma fix di web, PDF ikut kebawa bener.
- Given frontend Portfolio page, When render skill list, Then dicocokin ke
  `assessment.skills` (skill yang dikonfigurasi) — skill konfigurasi yang gak
  ada di hasil dapet card visual beda (bukan skor rendah, bukan kosong polos).

### Option A — Backend jadi source of truth (skill row eksplisit + status enum)
Tambah kolom `status` (enum: `assessed`, `not_assessed`, `unparseable`) ke
`portfolio_skills`. Setelah Gemini call, service proaktif bikin row buat
**semua** skill yang dikonfigurasi di assessment (bukan cuma yang Gemini
sebut) — isi `assessed` kalau ada level valid, `not_assessed` kalau gak
disebut sama sekali, `unparseable` kalau disebut tapi datanya rusak. Frontend
+ PDF generator tinggal render `status`.

- **Product impact vs cost**: Satu sumber kebenaran di DB — otomatis kebawa ke
  semua consumer (web, PDF, API lain kalau ada nanti). Cost: migration +
  perubahan service `Portfolios::Generator` (perlu diff configured-vs-returned
  skill di backend, bukan cuma clamp angka).
- **Maintainability**: Tinggi — status hidup di data, bukan logic duplikat di
  tiap tempat yang nampilin.
- **Failure mode**: Kalau service-nya sendiri ada bug pas diff skill, tetep
  ke-cover karena satu tempat aja yang perlu diaudit/di-test.
- **Contextual fit**: PDF export itu deliverable yang beneran diserahin ke
  hiring manager yang mungkin gak pernah buka web app — kalau fix cuma di
  frontend, PDF-nya tetep nunjukin skor rendah palsu. Root-cause fix wajib
  nyentuh backend.

### Option B — Frontend-only, diff di client
Backend tetep apa adanya (skip skill yang gak disebut). Frontend fetch
`assessment.skills` + `portfolio.skills`, diff sendiri, render "belum dinilai"
buat yang hilang.

- **Product impact vs cost**: Lebih cepet, gak ada migration, cuma sentuh 1
  komponen.
- **Maintainability**: Rendah — logic diff ke-duplikat kalau ada consumer lain
  (PDF, API partner nanti) yang butuh info sama.
- **Failure mode**: PDF export (server-side) **tetep salah** — assessor yang
  cuma liat PDF (bukan buka web) tetep keliru baca skor kandidat.
- **Contextual fit**: Nutup gejala di 1 layar doang, bukan nutup akar masalah.

**Keputusan: Option A.** Argumen penentu: PDF adalah artefak yang lebih
awet/portable daripada halaman web — hiring manager sering cuma baca PDF.
Fix yang gak nyentuh backend ninggalin celah paling berbahaya (salah baca skor
di dokumen resmi) tetep terbuka.

---

## Sub-PR 3: Candidate-Facing Error State (P0-3)

**Root cause**: `InterviewState` union gak punya state `"error"` sama sekali —
3 jalur kegagalan berbeda (fetch info gagal, WS error non-recoverable, reconnect
abis 3x) semua di-route ke state `"complete"` yang nampilin pesan sukses palsu.

### Acceptance Criteria
- Given fetch info kandidat gagal (network/404/token expired), When halaman
  render, Then tampil state error eksplisit ("Link ini bermasalah, hubungi
  tim rekrutmen") — bukan "Interview Complete".
- Given Gemini Live kirim error non-recoverable, When diterima di frontend,
  Then state jadi `"error"`, bukan `"complete"`.
- Given reconnect abis 3x percobaan gagal total, When itu kejadian, Then state
  `"error"` dengan pesan jelas "koneksi terputus, sesi belum tentu kesimpen,
  hubungi tim rekrutmen" — bukan ucapan terima kasih seolah kelar normal.
- Given sesi beneran selesai normal (assessor end / waktu abis / semua skill
  covered), When itu kejadian, Then tetep tampil `"complete"` seperti sekarang
  — regression check, jangan sampe fix ini malah bikin sesi normal ikut
  ke-flag error.
- Given koneksi sempet putus tapi reconnect berhasil dalam 3 percobaan, When
  itu kejadian, Then interview lanjut normal tanpa nampilin error sama sekali
  — regression check buat reconnect logic yang udah bener.

### Option A — Tambah state `"error"`, additive, minimal
Tambah `"error"` ke union `InterviewState`. Ganti 3 titik yang salah route
(`InterviewPage.tsx:43-52`, `useAudioWebSocket.ts:105-107`, `:122-131`) dari
`onStateChange("complete")` jadi `onStateChange("error", <alasan>)`. Render
1 komponen baru `InterviewErrorScreen` yang beda pesan/style dari
`InterviewCompleteScreen`.

- **Product impact vs cost**: Kecil, targeted, langsung nutup 3 bug konkret
  tanpa nyentuh logic reconnect/drain yang udah solid (per audit web/).
- **Maintainability**: Sedang — nambah 1 state ke union, gampang di-trace.
- **Failure mode**: Minim — perubahan aditif, gak ngubah state machine yang
  udah jalan.
- **Contextual fit**: Cocok buat timeline sempit — fix bug yang jelas tanpa
  redesign besar.

### Option B — Redesign state machine formal (mis. xstate)
Ganti seluruh pengelolaan `InterviewState` pake state machine library formal
biar transisi invalid gak mungkin kejadian by construction.

- **Product impact vs cost**: Lebih "benar" secara teori (garansi formal), tapi
  nambah dependency baru dan effort rewrite semua transisi yang sekarang
  sebenernya udah kerja (reconnect/drain/backoff logic-nya audit bilang solid).
- **Maintainability**: Bagus jangka panjang, tapi kurva belajar buat siapapun
  yang belum kenal xstate.
- **Failure mode**: Risiko regresi lebih besar — nyentuh state machine yang
  udah proven works cuma buat benerin 3 baris yang salah routing.
- **Contextual fit**: Overkill buat bug seukuran ini dan deadline sesempit ini
  — YAGNI, gak ada requirement baru yang butuh formal FSM.

**Keputusan: Option A.** Bug-nya sempit (3 titik salah route), gak perlu
bongkar state machine yang audit udah bilang "generally solid."

---

## Sub-PR 4: Hardware Check Reliability (P0-5)

**Root cause**: Speed test upload default ke `httpbin.org`/`postman-echo.com`
(pihak ketiga di luar kontrol platform); kalau ketiganya keblokir, fallback
hardcoded 0.5 Mbps yang otomatis di bawah threshold minimum 4 Mbps → kandidat
diblokir mulai interview padahal internetnya belum tentu jelek.

### Acceptance Criteria
- Given `VITE_SPEED_TEST_UPLOAD_URL`/`PING_URL` gak di-set (default kosong),
  When candidate jalanin hardware check, Then upload test ngarah ke endpoint
  milik backend sendiri (`api/`), bukan `httpbin.org`.
- Given endpoint speed-test sendiri gak kejangkau (backend beneran down), When
  itu kejadian, Then hasil ditandain "gak bisa diukur" (inconclusive) — beda
  dari "diukur dan hasilnya jelek." Kandidat dikasih pilihan lanjut dengan
  warning, bukan diblokir keras oleh angka fallback fiktif.
- Given koneksi kandidat beneran lambat (diukur dari endpoint sendiri, hasil
  di bawah threshold), When itu kejadian, Then tetep diblokir seperti desain
  awal — regression check, jangan sampe fix ini ngilangin proteksi yang
  emang perlu.
- Given kandidat retry setelah result awal "inconclusive", When retry, Then
  test ngukur ulang dari endpoint sendiri, gak ngulang endpoint eksternal yang
  emang lagi bermasalah.

### Option A — Endpoint speed-test sendiri di `api/` sebagai primary
Bikin 1 endpoint publik ringan di Rails (gak butuh auth, di-rate-limit) buat
ping + terima upload blob kecil, arahin `VITE_SPEED_TEST_PING_URL`/
`UPLOAD_URL` ke situ secara default. Env var buat override eksternal udah ada
dari awal (`web/.env.example`) — tinggal dipakein, bukan dibiarin nganggur.

- **Product impact vs cost**: Ngilangin dependency ke infrastruktur yang gak
  dikontrol platform ini sama sekali. Cost: nambah 1 endpoint kecil (gak
  butuh auth, gak nyentuh data model) — kecil.
- **Maintainability**: Tinggi — 1 endpoint milik sendiri, gampang dipantau
  uptime-nya bareng API utama.
- **Failure mode**: Kalau API sendiri down, ya interview juga gak bisa jalan
  (WebSocket-nya butuh API yang sama) — jadi gagalnya konsisten/masuk akal,
  bukan gagal palsu gara-gara layanan gak terkait.
- **Contextual fit**: Env var buat ini udah didesain dari awal (`.env.example`)
  tapi gak pernah dipakein ke default value — ini literally nyambungin sesuatu
  yang emang udah direncanain, bukan nambah kompleksitas baru.

### Option B — Ubah semantik gagal jadi soft-warning, tetep pake eksternal
Tetep pake `httpbin.org` dkk, tapi kalau semua endpoint gagal diukur, hasilnya
"inconclusive" (bukan fabrikasi 0.5 Mbps) dan kandidat boleh lanjut dengan
warning banner.

- **Product impact vs cost**: Paling murah — cuma ubah logic failure branch,
  gak ada endpoint baru.
- **Maintainability**: Sedang — tetep gantung ke reliability pihak ketiga yang
  gak dikontrol platform, cuma gejalanya udah gak seburuk sebelumnya.
- **Failure mode**: Nih tetep gak fix instrumen ukurnya — kalau `httpbin.org`
  down pas jam sibuk interview, semua kandidat dapet "inconclusive" barengan,
  ngurangin nilai gate ini secara keseluruhan (jadi jarang keukur beneran).
- **Contextual fit**: Tambal cepet, cocok kalau waktu bener-bener mepet, tapi
  ninggalin akar masalah (kontrol infrastruktur di luar tangan platform).

**Keputusan: Option A.** Effort-nya kecil (endpoint sendiri gampang di Rails
yang udah ada), env var-nya udah disiapin dari awal jadi ini nutup rencana
yang emang belum diselesaiin, dan ngilangin risiko produksi jangka panjang,
bukan cuma ngurangin gejalanya.

---

## Sub-PR 5 (opsional, ringan): UI/UX & Form Validation Polish

Bukan bagian dari 4 sub-PR P0 di atas, dan sengaja gak dikasih perlakuan
AC + Option A/B selengkap sub-PR P0 — alasannya ada di
[gap-analysis.md § Catatan Design Polish](gap-analysis.md#catatan-design-polish-di-luar-severity-list):
ini preferensi craft, bukan defect yang punya trade-off produk beneran
buat diperdebatkan (bukan "opsi mana yang benar", cuma "sempet dikerjain
atau nggak").

Cakupannya kalau digarap: polish halaman login (card layout, show/hide
password, state loading/error yang jelas), makein Zod yang udah
keinstall tapi nganggur ke form utama (assessment, custom skill) biar
nutup P2-6, dan badge status yang lebih gampang discan di Portfolio page
(match sama status `assessed`/`not_assessed`/`unparseable` dari Sub-PR 2).

Digarap incremental (mulai dari login page), disubmit sebagai PR terpisah
di luar 4 sub-PR P0 kapan pun siap ditest — gak ngeblok submission utama.

---

## Ringkasan Trade-off

| Sub-PR | Opsi dipilih | Kenapa |
|---|---|---|
| Tenant Isolation (P0-1/2) | A — denormalize + `TenantScoped` | Root-cause fix buat kerentanan keamanan yang udah kebukti gagal 2x dengan pola lama |
| Not-Assessed Skill (P0-4) | A — backend jadi source of truth | PDF export (artefak paling awet) harus ikut bener, gak cukup fix di web doang |
| Candidate Error State (P0-3) | A — tambah 1 state, additive | Bug-nya sempit, state machine lain udah solid, gak perlu redesign |
| Hardware Check (P0-5) | A — endpoint sendiri | Env var udah disiapin dari awal, effort kecil, ngilangin dependency luar kontrol |

Pola yang konsisten di seluruh keputusan: **selalu pilih fix di titik paling akar
yang effort-nya masih masuk akal buat timeline ini** — bukan opsi paling
murah, bukan juga opsi paling "sempurna secara teori" (ditolak di Sub-PR 3).

---

## Bonus (di luar 4 P0): Auth & Session Hardening (P1-4, P1-5, P1-6)

Di luar 4 sub-PR P0, 3 temuan P1 ini digarap juga karena satu tema
("kontrol siapa-boleh-masuk gak beneran ketat") dan severity-nya kerasa
lebih berat dari label "P1"-nya — auth bypass di platform hiring, bukan
cuma UX glitch. P1-1/2/3 tetep didokumentasiin sebagai deferred (lihat
gap-analysis.md), gak digarap — investigasinya belum sedalam 3 ini.

### P1-6: Dev token bikin logout gak beneran logout

**AC**: Gak ada opsi/trade-off beneran di sini — cuma bug, hapus fallback-nya.
- Given `VITE_DEV_TOKEN` keisi di `.env`, When app dimuat tanpa token di
  `localStorage` (baru pertama kali, atau abis logout), Then user liat
  halaman login — gak pernah ke-auth otomatis dari env var.
- Given user udah login (token asli di `localStorage`), When app reload,
  Then tetep ke-auth normal (regression check).

Fix: hapus `?? import.meta.env.VITE_DEV_TOKEN` dari `getStoredToken()`.

### P1-4: Invite token gak pernah kedaluwarsa

**AC**:
- Given session `pending` umur < 7 hari, When candidate akses
  `candidate_info`/`audio_complete`, Then normal (regression check).
- Given session `pending` umur > 7 hari, When diakses, Then `410 Gone`.
- Given session udah `active`/`ended` (walau umurnya > 7 hari), When
  diakses, Then tetep normal — interview yang lagi jalan atau udah kelar
  gak boleh keblokir aturan ini.

**Option A (dipilih) — TTL diturunin dari `created_at` yang udah ada.**
Gak ada migration, gak ada kolom baru — `Session#invite_expired?` tinggal
`pending? && created_at < 7.days.ago`.
- Product impact vs cost: Cost minimal (0 migration), langsung nutup gap.
- Maintainability: Simpel, 1 method, gampang di-reason.
- Contextual fit: Gak ada spec produk yang minta durasi custom per-session
  — bikin kolom `invite_expires_at` buat itu cuma spekulasi (YAGNI).

**Option B (ditolak) — kolom `invite_expires_at` per-session.**
Lebih fleksibel (assessor bisa atur durasi beda-beda), tapi butuh migration
dan gak ada satupun requirement produk yang minta fleksibilitas itu hari
ini — cost naik buat manfaat yang belum tentu kepake.

**Keputusan: Option A.**

### P1-5: JWT/akun gak pernah di-revoke

**AC**:
- Given admin `active: false`, When request pake token yang masih valid
  signature-nya dan belum expired, Then ditolak (403) dalam window ≤60
  detik dari deaktivasi — bukan nunggu token expired 3 hari.
- Given admin `active: true` (default), When request, Then jalan normal,
  gak ada tambahan latency berarti (di-cache).
- Given token role `assessor` (diterbitin `rakamin-api`, akun-nya gak ada
  di tabel `users` lokal app ini), When request, Then gak kena efek apa-apa
  dari perubahan ini — regression check buat token dari app sister.
- **Constraint yang diterima sadar**: belum ada UI admin buat toggle
  `active` — hari ini cuma bisa lewat `rails console`/DB langsung. Bikin
  UI manajemen user itu fitur terpisah yang lebih besar, di luar scope fix
  keamanan ini.

**Option A (dipilih) — kolom `active` di `users` + cache 60 detik di `AuthorizeApiRequest`, scoped ke role `admin` doang.**
- Product impact vs cost: Nutup celah paling parah (gak ada cara sama
  sekali buat cabut akses) dengan cost kecil — 1 kolom, cache pake
  `Rails.cache` yang mekanismenya udah ada (dipake production.rb).
- Maintainability: Tinggi, 1 method (`account_active?`), gampang dites.
- Failure mode: Window staleness maksimal 60 detik — jauh lebih baik dari
  window 3 hari sekarang, dan `Rails.cache` di test env `:null_store`
  (selalu fresh) jadi behavior gampang diverifikasi via test.
- Contextual fit: **Scoped ke role `admin` doang** — role `assessor`
  diterbitin app sister (`rakamin-api`) buat akun yang gak ada di tabel
  lokal `users` sama sekali, jadi gak ada yang bisa dicek di sini buat
  role itu. Ini batasan jujur, bukan corner yang sengaja dilewatin diam-diam
  — masuk Constraint Signal di gap-analysis.md.

**Option B (ditolak) — query DB tiap request, gak pake cache.**
- Product impact vs cost: Zero staleness (langsung ke-detect), tapi nambah
  1 DB hit ke **tiap** request terautentikasi buat kejadian yang jarang
  banget (deaktivasi akun) — persis lawan dari alasan desain awal
  ("Does NOT hit the database ... trusts the JWT claims").
- Maintainability: Sama simpelnya, tapi ngelanggar prinsip desain yang
  udah ada di kode tanpa alasan kuat (window 60 detik udah cukup buat
  ancaman ini).
- Contextual fit: Overkill — trade latency semua request demi presisi yang
  gak dibutuhin buat threat model ini.

**Option C (ditolak) — Redis blocklist per-`jti` token, dipicu event logout/deactivate.**
- Lebih presisi (per-token, bukan per-user), tapi butuh nambahin klaim
  `jti` ke semua token yang diterbitin — sedangkan token bisa juga
  diterbitin app sister (`rakamin-api`) yang gak tentu nyertain `jti` sama
  sekali. Gak reliable buat kasus lintas-app ini dibanding cek `active`
  flag di data yang emang udah dipegang bersama.

**Keputusan: Option A.**

---

## Bonus 2: Invite link nunjuk ke origin yang salah (P0-6)

Ketauan pas manual testing "Copy link" di browser beneran (bukan dari code
review) — link yang dihasilin nunjuk ke port API (3001), padahal
`/interview/:token` itu route frontend (Vite). Gak ada trade-off Option
A/B beneran di sini — ini murni salah pasang env var, bukan keputusan
desain yang punya sisi lain buat dipertimbangin.

**AC**:
- Given `FRONTEND_BASE_URL` di-set, When `Session#invite_url` dipanggil,
  Then hasilnya `"#{FRONTEND_BASE_URL}/interview/#{invite_token}"`.
- Given `FRONTEND_BASE_URL` gak di-set, When dipanggil, Then default ke
  `http://localhost:5173` (Vite dev server lokal) — bukan default ke
  `APP_BASE_URL`/port backend.

**Fix**: tambah env var baru `FRONTEND_BASE_URL`, ganti `invite_url` biar
pake itu, bukan `APP_BASE_URL`. Update dokumentasi (`README.md`,
`application.yml.sample`) biar jelas beda fungsi 2 env var itu.

---

## Bonus 3: `Organization.table_name` schema-qualification + expose `candidate_name`

Dua perubahan kecil gak berhubungan langsung, digabung 1 PR karena
sama-sama backend-kecil:

1. **`Organization.table_name` di-qualify eksplisit** jadi
   `'public.organizations'` — hardening defensif terhadap ambiguitas
   `search_path`. Lihat catatan di gap-analysis.md (bukan P-numbered gap,
   ini insiden dev lokal, bukan bug fresh-install). Test: pin
   `table_name`, plus test yang beneran simulasiin skenario bahaya (bikin
   tabel decoy `ai_interview.organizations` di test, buktiin
   `Organization.identify` tetep bener nemuin yang asli).
2. **`candidate_info` endpoint expose `candidate_name`** — field udah ada
   di tabel `sessions` dari awal, cuma belum pernah disertain di response
   JSON; frontend butuh ini buat nyapa kandidat pake nama di halaman
   interview. Gak ada trade-off — nambah 1 field ke response, non-breaking.
