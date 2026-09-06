# 04 — Implementasi: Apa yang Diubah, dan Kenapa

Dokumen ini menceritakan perubahan yang **memang ada di working tree** — bukan rencana,
bukan aspirasi. Angka berikut dari `git log` di branch `feat/assessment-integrity`
(repo root `ai-interview-platform/`):

> **13 commit** pada dua sisi: frontend (#4–#9) dan backend (#1–#3 + harness BE),
> plus file baru: `web/src/utils/confidence.ts`, `web/src/components/fitgap/DiscoveredSkillRow.tsx`,
> `web/src/test/setup.ts`, **10 file test FE**, `api/spec/**` (2 helper + 1 support +
> factories + **5 file spec**), `api/app/services/portfolios/level_parser.rb`,
> `api/db/migrate/20260906000000_relax_portfolio_skills_ai_level.rb`,
> `api/Dockerfile.dev`, `web/eslint.config.js`, `web/.prettierrc.json`,
> `web/.prettierignore`, `web/package-lock.json`, dan `.github/workflows/ci.yml`.

State kode **sebelum** perubahan (bukti `file:line` bug) ada di [02](./02-findings-p0-p3.md);
alasan memilih opsi ini alih-alih yang lain ada di [03](./03-options-tradeoffs.md).

## 1. Cakupan: apa yang mendarat di kode, apa yang masih rencana

| # | Perbaikan | Status | File utama |
|---|---|---|---|
| #1 | Batasi lompatan `StateEngine` | ✅ | `api/app/services/coverage/state_engine.rb` + spec |
| #2 | Auto-advance tidak lagi mengarang `covered` | ✅ | `api/app/workers/coverage_analyzer_worker.rb` + spec |
| #3 | `level` hilang → `unknown`, bukan L1 | ✅ | `api/app/services/portfolios/level_parser.rb` (baru), `generator.rb`, migrasi `relax_portfolio_skills_ai_level`, `portfolio_skill.rb`, + jahitan FE `types/index.ts`, `DiscoveredSkillRow.tsx` + specs/tests |
| #4 | Confidence kanonik: unknown ≠ LOW, medium ≠ confirmed | ✅ | `confidence.ts`, `ConfidenceIndicator.tsx`, `FitGapReportPage.tsx`, `SkillPortfolioCard.tsx` |
| #5 | `parseLevel` gagal ≠ 1 | ✅ | `constants.ts`, `LevelBadge.tsx`, `OverridePanel.tsx`, `LevelRadio.tsx` |
| #6 | `ai_level`: `string` → `number` | ✅ | `types/index.ts` |
| #7 | Error interview ≠ "Complete" | ✅ | `InterviewPage.tsx` (191 baris), `useAudioWebSocket.ts`, `types/index.ts` |
| #8 | `LevelRadio` id di-scope + `aria-label` | ✅ | `LevelRadio.tsx` + 4 pemanggil |
| #9 | Harness: test, typecheck, lint, CI | ✅ FE + BE | FE: `vite.config.ts`, `package.json`, `eslint.config.js`, `ci.yml`, `src/test/` · BE: `spec/**`, `Dockerfile.dev`, job `api` di `ci.yml` |

Porsi FE:BE yang dikerjakan: **FE 6 perbaikan, BE 3 perbaikan + harness dua sisi** —
59 test FE (47) dan BE (43 RSpec examples) semuanya hijau, plus satu seeded fault per
sisi dengan bukti MERAH→HIJAU.

## 2. #9 dikerjakan **dulu**: harness sebelum perbaikan

Perbaikan #4–#8 tidak bisa dibuktikan tanpa yang bisa menjalankannya. Jadi urutan kerjanya
membalik intuisi: infrastruktur dulu, baru perbaikan.

**`web/package.json`** — scripts baru (8): `test`, `test:watch`, `test:coverage`,
`typecheck`, `lint`, `lint:fix`, `format`, `format:check`. devDependencies baru (13):
vitest 3.2.7 + `@vitest/coverage-v8`, jsdom 25, `@testing-library/react` 16 + `jest-dom` +
`user-event`, eslint 10 + `@eslint/js` + `typescript-eslint` + `eslint-config-prettier` +
`eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` + `globals`, prettier 3.9.
**Tidak ada runtime dependency baru** — semuanya dev-only.

**`web/vite.config.ts`** — blok `test` (jsdom, `globals: true`, `setupFiles`, coverage v8).
> **Jebakan yang kujumpai:** konfigurasi test sengaja ditaruh di `vite.config.ts`,
> **bukan** `vitest.config.ts`. Kalau `vitest.config.ts` ada, vitest mengabaikannya
> `vite.config.ts` sepenuhnya — alias `@ → ./src` akan hilang dan semua import `@/...`
> di test gagal. Satu file, satu sumber kebenaran.

**`web/src/test/setup.ts`** — matcher `@testing-library/jest-dom` + `cleanup()` di
`afterEach` (supaya state tidak bocor antar test).

**`web/eslint.config.js`** — flat config (eslint 10), `typescript-eslint` + `react-hooks` +
`react-refresh` + `eslint-config-prettier` (agar prettier tidak berperang dengan eslint).
**`web/.prettierrc.json`** + **`web/.prettierignore`**.

Dua penyesuaian kecil supaya lint **exit 0 tanpa menulis ulang** codebase:
- `web/tailwind.config.js`: `require("tailwindcss-animate")` → `import` (ESM; `require`
  tidak bisa direkam oleh eslint di mode ESM).
- `web/src/main.tsx`: satu `// eslint-disable-next-line @typescript-eslint/no-non-null-assertion`
  dengan alasan eksplisit di komentarnya (`createRoot(document.getElementById("root")!)` —
  element dijamin ada oleh Vite mount). Satu baris yang dikecualikan dengan alasan > aturan
  yang dibungkam diam-diam.

**`.github/workflows/ci.yml` (root repo)** — 4 step berurutan: `typecheck` → `lint` →
`test` → `build`, Node 20, `working-directory: web`.
> **Jebakan kedua:** file ini pernah kusimpan di `web/.github/workflows/` — **tidak akan
> pernah dijalankan**. GitHub Actions hanya membaca `.github/workflows/` di **root repo**.
> Sudah dipindah; hanya satu `ci.yml` yang tersisa. Job `api` (rspec + rubocop + service
> Postgres/Redis) sengaja **dikomentari** di bawah dengan catatan "ditambahkan setelah
> perbaikan #1–#3" — CI yang hijau palsu tidak lebih baik daripada tidak ada CI.

## 2b. Harness backend — Docker, karena Ruby native di Windows bukan pilihan

**`api/Dockerfile.dev`** (baru) — `ruby:3.3.2` + build-essential/libpq-dev, `bundle
install` lengkap (termasuk group test) di-bake ke image; source di-mount saat runtime.
PostgreSQL 16 (`aiint-pg`) dan Redis 7 (`aiint-redis`) jalan sebagai container di network
Docker yang sama, dengan `config/application.yml` (figaro, gitignored) menunjuk ke sana.

**`api/spec/`** — di-bootstrap dari nol (D1): `spec_helper.rb`, `rails_helper.rb`
(`use_transactional_fixtures`), `spec/support/factory_bot.rb`, `spec/factories.rb`
(rantai minimum organization → assessment → session → coverage_map/portfolio). Semua
gem-nya (`rspec-rails`, `factory_bot_rails`) **sudah dideklarasikan Gemfile sejak repo
di-import** — mengaktifkan pilihan tim, bukan menambah dependensi.

Dua kegagalan nyata saat bootstrapping (dipertahankan di [05 §4b](./05-testing.md),
karena keduanya momen verifikasi): `db:prepare` memuat `schema.rb` lama sehingga spec
generator merah dengan `PG::NotNullViolation` sebelum `db:migrate` jalan; dan versi
pertama migrasi #3 memakai `drop_check_constraint` — method yang tidak ada di Rails 7.0
(yang benar: `remove_check_constraint`).

## 2c. Job `api` di CI — service container Postgres + Redis, `db:prepare` → `rspec`

`ci.yml` (root repo) kini dua job: `web` (typecheck → lint → test → build) dan `api`
(`ruby/setup-ruby` + `bundler-cache`, services `postgres:16` + `redis:7` dengan health
check, `db:prepare`, `rspec`). Rubocop sengaja tidak masuk CI: menjalankan rubocop atas
codebase lama yang belum pernah di-lint = keputusan tim tentang gaya, bukan bagian
perbaikan integritas (alasan yang sama dengan D4/D6 di [06](./06-not-done-and-why.md)).

## 2.5 #1 — `StateEngine` maju maksimal satu state per panggilan (A1, P0)

**`api/app/services/coverage/state_engine.rb`** — loop
`(current_idx + 1).upto(proposed_idx)` lama memakai ulang `probe_count` yang sama di
setiap anak tangga, jadi satu panggilan dengan `probe_count == 2` mendorong
`not_yet → initiated → partial → covered` sekaligus: gate HARD RULE tidak pernah bisa
gagal karena tidak pernah dievaluasi ulang terhadap probe yang dibuat *setelah* masuk
state baru.

Perbaikannya: satu panggilan maju paling banyak satu state. Keputusan produknya
(dokumentasi di kode): turn transkrip berikutnya mendapat `resolve_state` baru dan boleh
maju satu rung lagi kalau bukti masih mendukung — coverage map bisa terlambat beberapa
turn di kondisi ideal, tapi tidak pernah melompati. `resolve_state` tetap pure function:
diff minimal, seeded fault paling jujur (kembalikan loop asli = merah, terlihat di
[05 §4b](./05-testing.md)).

## 2.6 #2 — stale partials dilaporkan, tidak dikarang jadi `covered` (A2, P0)

**`api/app/workers/coverage_analyzer_worker.rb`** — `advance_stale_partials` lama
menulis `state: 'covered'` dan menimpa `last_signal` dengan string robot
`"Auto-advanced: outside context window with sufficient probes"` — padahal portfolio
generator mengutip `last_signal` sebagai *evidence* penilaian. Otomasi mengarang verdict
sekaligus alasannya.

Perbaikannya: method jadi `log_stale_partials` — **tidak menulis apa pun**. Skill tetap
`partial` sampai AI benar-benar menilai (prompt generator sudah mengenali `partial` →
confidence medium, jadi jalur produk tetap hidup), dan kestagnannya dilaporkan lewat
`Rails.logger.warn` terstruktur: `session_id`, `coverage_map_id`, `skill_label`,
`probe_count` + alasan. Spec worker mengunci tiga hal: tidak ada perubahan state, tidak
ada perubahan `last_signal`, dan log terstruktur terkirim (plus negative case:
probe_count < 4 dan skill yang baru dibahas di run yang sama tidak dilaporkan).

## 2.7 #3 — level AI yang hilang tersimpan `NULL`, bukan L1 (A3, P1)

Tiga lapisan, karena data yang hilang harus punya tempat yang jujur di setiap lapisan:

1. **`api/app/services/portfolios/level_parser.rb`** (baru, pure module) — mirror dari
   `parseLevel` di FE: `level.to_i.clamp(1, 5)` lama mengarang rating di DUA arah
   (nil/garbage → 0 → **L1**; 99 → clamp ke **L5**). Kini: unparseable / di luar 1..5 /
   Float → `nil`.
2. **Migrasi `relax_portfolio_skills_ai_level`** — `ai_level` nullable + CHECK
   diperluas (`ai_level IS NULL OR (ai_level >= 1 AND ai_level <= 5)`); validasi model
   ikut (`allow_nil: true`). `down`-nya dijaga: kalau ada baris NULL, migrasi **menolak
   jalan** dengan pesan eksplisit — backfill angka karangan adalah persis bug yang
   dihapus. Siklus `db:rollback STEP=1` → `db:migrate` dijalankan dan schema.rb balik-benar
   (bukti di [05 §4b](./05-testing.md)).
3. **Jahitan FE** — `PortfolioSkill.ai_level: number | null` mengikuti kontrak baru;
   `DiscoveredSkillRow` (yang mengindeks `LEVEL_LABELS[skill.ai_level]` langsung — akan
   merender `undefined`) kini lewat `parseLevel` dan menampilkan "Unknown level" + test
   negatifnya. `LevelBadge`/`OverridePanel`/`SkillPortfolioCard` sudah siap sejak #5.

## 3. #4 — Satu suara untuk confidence (A4, P1)

Masalah aslinya (dipertahankan sebagai komentar di kepala `confidence.ts`): satu nilai
`ai_confidence` diinterpretasikan di **tiga tempat dengan tiga hasil berbeda** —
`ConfidenceIndicator` fallback ke `"LOW"`, `FitGapReportPage:196` membaca `medium`
sebagai `"confirmed"`, `SkillPortfolioCard:45` punya aturan ketiga sendiri.

**`web/src/utils/confidence.ts`** (baru, 74 baris) — satu-satunya tempat nilai diterjemahkan:

| Input | `toConfidenceLabel` | `toConfidencePhrase` |
|---|---|---|
| `"high"` / `"HIGH"` | `HIGH` | `confirmed` |
| `"medium"` | `MEDIUM` | `medium confidence` |
| `"low"` | `LOW` | `low confidence` |
| `null` / `undefined` / `""` / sampah | **`UNKNOWN`** | `confidence not available` |

Empat fungsi: `toConfidenceLabel` (kanonik), `toConfidencePhrase` (inline di kalimat),
`isLowConfidence`, `isConfidenceKnown`. Keputusan inti: **`UNKNOWN` bukan level
keempat** — itu penanda data tidak ada, dan mencampurkannya dengan `LOW` berarti
mengarang penilaian atas kandidat yang tidak pernah dihitung AI. Sumber kontrak:
`api/app/models/portfolio_skill.rb:4` (`CONFIDENCE_LEVELS = %w[high medium low]`) dan
`api/db/schema.rb:116` (enum `null: false`).

Pemakai:
- **`ConfidenceIndicator.tsx`** (45 baris berubah) — prop sekarang
  `string | null | undefined`, empat cabang HIGH/MEDIUM/LOW/fallback. Fallback menampilkan
  ikon `AlertCircle` + "confidence not available" dengan title: *"Ini bukan penilaian
  rendah — datanya memang tidak ada."*
- **`FitGapReportPage.tsx`** (9 baris) — ternary inline diekstrak ke
  **`DiscoveredSkillRow.tsx`** (komponen baru, presentasi murni) supaya tabel tidak
  membesar dan baris bisa dites sendiri.
- **`SkillPortfolioCard.tsx`** (15 baris) — `=== "low" &&` → `isLowConfidence(...)`, plus
  blok **baru** untuk `!isConfidenceKnown(...)`: kartu yang confidence-nya hilang kini
  bilang sendiri — *"Treat the level above as unverified — do not read it as either
  strong or weak evidence."* Sebelumnya kartu itu diam, dan terlihat sama meyakinkannya
  dengan skill yang benar-benar terverifikasi.

**Verifikasi:** `ConfidenceIndicator.test.tsx` (4 cabang), `DiscoveredSkillRow.test.tsx`,
`SkillPortfolioCard.test.tsx` — termasuk kasus `"medium"` **tidak** boleh menghasilkan
kata "confirmed" di layar mana pun.

## 4. #5 — `parseLevel` berhenti mengarang L1 (A3/D5, P1)

**`web/src/utils/constants.ts`** (43 baris) — sebelumnya 4 baris dengan `parseInt(...) || 1`
setiap kegagalan parsing jatuh ke **L1** (rating terendah). Sekarang:

```ts
export function parseLevel(level: string | number | null | undefined): number | null {
  if (level === null || level === undefined) return null;
  const n = typeof level === "number" ? level : parseInt(level.replace(/\D/g, ""), 10);
  if (!Number.isInteger(n)) return null;
  if (n < 1 || n > 5) return null;
  return n;
}
```

| Input | Hasil |
|---|---|
| `3` | `3` |
| `"3"`, `"L3"` | `3` |
| `"3.5"`, `"abc"`, `""` | `null` |
| `null`, `undefined`, `0`, `6` | `null` |

Efek beruntun — ini bagian yang membuat perbaikannya **sistemik, bukan punktual**:

- **`LevelBadge.tsx`** (55 baris) — prop jadi `number | null | undefined`; memvalidasi
  ulang **di komponen** (bukan mendorong ke setiap pemanggil — penjagaan yang disebar
  akan bocor di pemanggil berikutnya yang belum ditulis). Kalau `null`: kotak putus-putus
  "Unknown", bukan kotak kosong. Komentar di kodenya menyebut alasannya: kotak kosong
  adalah kegagalan paling mahal — tidak terlihat seperti error, hanya seperti bug
  styling, jadi tidak ada yang melaporkannya.
- **`OverridePanel.tsx`** (48 baris) — `canSave = overrideLevel != null`; guard
  `if (overrideLevel == null) return;` **di dalam handler** (bukan cuma `disabled` —
  `disabled` adalah presentasi, dan presentasi bisa dilanggar). Menyimpan override tanpa
  pilihan berarti menulis kesaksian atas nama assessor yang tidak pernah bersaksi. Ditambah
  kalimat penjelasan di bawah tombol yang mati, supaya assessor tahu *kenapa* (AI tidak
  memberi level yang bisa dipakai), bukan sekadar dilarang.
- **`LevelRadio.tsx`** — `value: number | null | undefined`; radio **tidak** mengisi
  angka karangan (detail di §7).

## 5. #6 — `ai_level`: `string` → `number` (D5, P1)

**`web/src/types/index.ts`** (57 baris berubah) — `PortfolioSkill.ai_level` dari `string`
ke `number`, dengan komentar kontrak yang menunjuk ke `api/db/schema.rb:115,120`
(`ai_level integer, null: false`, validasi 1..5) dan `portfolios_controller.rb:181`
(serializer meneruskan integer apa adanya — prefiks "L" itu bahasa presentasi
`LEVEL_LABELS`, bukan bahasa API).

Kenapa ini perbaikan, bukan sekadar ganti tipe: **sebelumnya, cabang
`typeof level === "number"` di `parseLevel` adalah dead code** — lewat jalur normal data
selalu string, jadi cabang number tidak pernah keverifikasi. Setelah tipe ikut kontrak
DB, cabang itu nyata, dan `tsc --noEmit` memaksa **setiap** konsumen
(`LevelBadge`, `ComparisonTable`, `OverridePanel`, `LevelRadio`) dikompilasi ulang
terhadap kontrak yang benar. 57 baris itu sebagian besar komentar — sengaja: pembaca
berikutnya harus bisa melihat **ke mana** kontrak itu menunjuk tanpa harus menemukannya
sendiri.

**Verifikasi:** `tsc --noEmit` bersih; `constants.test.ts` menguji kedua bentuk input
(number dan string) karena keduanya kini sah.

## 6. #7 — Error tidak lagi "Complete" (B1 + B2, P0) — perubahan terbesar

**`web/src/pages/interview/InterviewPage.tsx` (191 baris berubah)** — baris aslinya:
`.catch(() => setInterviewState("complete"))`. Token kedaluwarsa, 404, API mati —
semuanya mendarat di layar "Interview Complete" dengan ucapan terima kasih.

Yang dikerjakan:
1. **Alasan kegagalan disimpan ke state** — backend sudah mengirim pesan yang enak
   dibaca manusia (`api/app/controllers/api/v1/sessions_controller.rb:132-154` →
   "Invalid or expired invite token", "Assessment not found"); sebelumnya pesan itu
   di-*discard* oleh `.catch`. Menyimpan alasan adalah setengah perbaikan; separuh
   lainnya adalah punya layar yang mau menampilkannya.
2. **Dua state baru, karena dua pemulihan yang berbeda** (pilihan B di [03](./03-options-tradeoffs.md)):
   - `error` — wawancara **belum pernah mulai** → layar `role="alert"` dengan alasan
     dari server + "Try again" (tanya ulang server).
   - `connection_lost` — wawancara **sudah jalan** lalu sambungannya habis → layar
     "Reconnect" yang menyebut eksplisit: *jawaban yang sudah diberikan tidak hilang*.
     Tombolnya memanggil `startInterview` (sambung ulang), **bukan** reload halaman.
     Mic langsung di-*mute* — lampu mic yang tetap menyala ke socket yang sudah tutup
     adalah kebohongan kecil versi lain.
3. **Resiliensi yang sudah ada tidak disentuh** — dan ini nuansa yang harus kujaga saat
   defense: halaman ini *bukan* tanpa resiliensi. Timer 60 detik `connectionLostTimerRef`,
   timer `draining_audio`, state `reconnecting`, guard `audioCompleteCalledRef`, dan
   retry `audioComplete` dengan backoff (×2, max 8 dtk) semuanya sudah ada. Cacatnya
   spesifik: **satu `.catch` terminal** yang meruntuhkan semua kelas error ke state yang
   terlihat seperti sukses.
4. **`useAudioWebSocket.ts`** (23 baris) — `onStateChange("complete")` tadinya dipanggil
   di **tiga** tempat; sekarang:
   - `case "error"`: hanya `!msg.recoverable` yang terminal → `onStateChange("error")`
     (sebelumnya `"complete"`);
   - `case "session_ended"` → `onStateChange("complete")` — **satu-satunya** "complete"
     yang jujur (sesi benar-benar selesai di server);
   - `onclose` setelah 3× reconnect gagal (`[1000, 2000, 4000]` ms) →
     `onStateChange("connection_lost")` (sebelumnya `"complete"`).
   Pemisahan dilakukan **di sumbernya** (hook), bukan di gejala halamannya.
5. **`types/index.ts`** — `InterviewState` bertambah `"error" | "connection_lost"` dengan
   komentar yang memisahkan *alasan pemulihan* dari sekadar label status.

Detil teknis yang menjaga koreksi agar tidak kebablasan (functional updater
`prev === "error" ? "idle" : prev`, guard kebalikan `session_ended` tetap hijau) ada di
[05-testing.md](./05-testing.md) — di sana juga bukti MERAH→HIJAU-nya.

## 7. #8 — `LevelRadio`: id di-scope, radio tidak mengarang nilai (E1, P1)

**`web/src/components/assessment/LevelRadio.tsx`** (77 baris berubah):
- **`useId()`** — id tiap item jadi `` `${uid}-level-${level}` ``. Sebelum: `level-${level}`
  saja → id **global bertabrakan** di `.map()`; klik "L4" di skill kedua mengubah skill
  pertama — dan vacancy itu patokan penilaian setiap kandidat pelamarnya.
- **`value: number | null | undefined`** — `selected = value == null ? "" : String(value)`.
  Radio kosong untuk "belum ada yang memilih" — mengisi angka karangan adalah klaim
  bahwa ada penilaian padahal tidak (pola yang sama dengan #5).
- **`label?: string`** → `aria-label={label ? \`${label} level\` : "Level"}`. Opsional
  supaya pemanggil tidak dipaksa berubah serentak; yang di dalam `.map()` mengisinya.

Empat pemanggil diisi `label={...}`: `SkillCard.tsx`, `VacancyNewPage.tsx`,
`VacancyEditPage.tsx`, dan `CustomSkillForm.tsx` (8 baris — `skill_label` diambil via
`useWatch` dari field yang barusan diisi assessor; kalau belum diisi, **jangan
mengarang nama** — biarkan label generiknya).

**Verifikasi:** `LevelRadio.test.tsx` (pilih/ubah/`value=null` tidak mengisi karangan) +
`LevelRadio.a11y.test.tsx` (id unik antar instance, `aria-label` terpasang, klik label
skill #2 tidak menyentuh skill #1).

## 8. Perubahan kecil penyerta (bukan perbaikan terpisah)

| File | Perubahan | Alasan |
|---|---|---|
| `AssessmentInvitePage.tsx` (8 baris) | guard `if (id == null) return null` (setelah semua hook, sebelum render) + hapus `id!` | `id!` dihapus karena aturan `no-non-null-assertion`; guard menempati fungsinya dengan tempat yang benar (aturan hook) |
| `ComparisonTable.tsx` (2 baris) | `let icon = ""` → `let icon: string` | inisialisasi yang pasti ditimpa oleh semua cabang — sisa yang dilaporkan lint |
| `main.tsx` (1 baris) | `eslint-disable-next-line` + komentar | lihat §2 |
| `tailwind.config.js` (4 baris) | `require` → `import` | lihat §2 |

## 9. Yang sengaja **tidak** disentuh

- **B3, B4, C1–C9, D4, E2, E3, S2** — alasan per temuan ada di [06](./06-not-done-and-why.md).
- **`web/src/components/ui/**`** (shadcn) — bukan target domain; juga dikecualikan dari
  coverage (`vite.config.ts` coverage `exclude`).
- **Tidak ada runtime dependency baru** — semua devDependency; `package-lock.json`
  masuk agar `npm ci` di CI deterministik. Sisi backend: tidak ada gem baru sama sekali
  (rspec-rails/factory_bot sudah di Gemfile).
- **`retry: 0` / rescue telanjang / lock di worker** (bagian bukti A2) — dibiarkan;
  memperbaikinya = keputusan desain job queue tim, bukan bagian tema integritas
  (dibahas di [06](./06-not-done-and-why.md)).
- **`ai_confidence` yang tidak dikenal di generator** — dibiarkan gagal keras
  (enum + validasi inclusion menolak → portfolio `failed` + `generation_error`):
  kegagalan yang berisik lebih baik daripada nilai yang dikarang, dan mengubah
  semantik confidence bukan bagian #3.

## 10. Verifikasi per perbaikan

| # | Yang dijalankan | Hasil |
|---|---|---|
| #1 | `rspec spec/services/coverage/state_engine_spec.rb` (10 contoh, table-driven) | ✅ — + seeded fault MERAH `7 examples, 2 failures` → revert → HIJAU |
| #2 | `rspec spec/workers/coverage_analyzer_worker_spec.rb` (8 contoh, DB nyata + analyzer di-stub) | ✅ — state & last_signal tidak berubah, log terstruktur terkunci |
| #3 | `rspec` LevelParser (19 kasus table-driven) + Generator (5, DB nyata) + model (5) + `db:rollback`→`db:migrate` + `tsc` + test FE baru | ✅ semua hijau; migrasi terbukti reversibel |
| #4 | `ConfidenceIndicator.test.tsx`, `DiscoveredSkillRow.test.tsx`, `SkillPortfolioCard.test.tsx`, `tsc` | ✅ (detail di [05](./05-testing.md)) |
| #5 | `constants.test.ts` (table-driven), `LevelRadio.test.tsx`, `OverridePanel.test.tsx`, `tsc` | ✅ |
| #6 | `tsc --noEmit` (memaksa semua konsumen kompilasi ulang) | ✅ bersih |
| #7 | `InterviewPage.test.tsx` (mock axios + WebSocket), `tsc` | ✅ — termasuk bukti MERAH→HIJAU |
| #8 | `LevelRadio.test.tsx` + `LevelRadio.a11y.test.tsx` | ✅ |
| #9 | FE: `npm run test` (9 file / 47 test), `tsc --noEmit`, `npm run lint`, `npm run build` · BE: `RAILS_ENV=test rspec` (43 contoh) · CI: 2 job siap | ✅ 47/47, exit 0, exit 0 (17 warnings, 0 errors), build sukses; BE 43/0 |

Bukti MERAH→HIJAU dua sisi, 3 AI Verification Moment, dan tabel No Regression:
[05-testing.md](./05-testing.md).

---

> **[PERLU SUARAMU — sebelum defense, jawab ini dengan kata-katamu sendiri untuk tiap
> perbaikan yang sudah mendarat (#1–#9)]:**
> 1. *Apa yang akan rusak kalau kamu TIDAK melakukan perbaikan ini?* (kalimat dampak,
>    bukan kalimat teknis — untuk #7: "kandidat pulang yakin wawancaranya selesai,
>    padahal belum pernah mulai"; untuk #1: "satu turn dengan probe_count 2 bisa
>    menutup skill yang belum pernah digali — lalu portfolio menilai seolah sudah")
> 2. *Kenapa opsi ini dan bukan yang lain?* (baca [03](./03-options-tradeoffs.md) dulu,
>    lalu tutup — ceritakan ulang)
> 3. Satu detail yang bisa kamu tunjuk langsung di kode tanpa cari-cari (mis. #4: baris
>    `return "UNKNOWN"` di `confidence.ts`; #7: satu-satunya pemanggil
>    `onStateChange("complete")` di `useAudioWebSocket.ts`; #1: komentar
>    "AT MOST one state forward per call" di `state_engine.rb`; #3: guard
>    `raise` di `down` migrasi).
> 4. Untuk BE: pahami setup Docker-nya (Postgres/Redis container → `db:prepare` →
>    `rspec`) — hampir pasti ditanya "spec-mu jalan di mana dan bagaimana?".
