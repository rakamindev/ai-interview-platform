# 04 — Implementasi: Apa yang Diubah, dan Kenapa

Dokumen ini menceritakan perubahan yang **memang ada di working tree** — bukan rencana,
bukan aspirasi. Angka berikut dari `git diff --stat` (direpo root
`ai-interview-platform/`, di-verify ulang sebelum submit):

> **20 file changed — 524 insertions(+), 106 deletions(−)**, plus file baru:
> `web/src/utils/confidence.ts`, `web/src/components/fitgap/DiscoveredSkillRow.tsx`,
> `web/src/test/setup.ts`, **9 file test**, `web/eslint.config.js`, `web/.prettierrc.json`,
> `web/.prettierignore`, `web/package-lock.json`, dan `.github/workflows/ci.yml`.

State kode **sebelum** perubahan (bukti `file:line` bug) ada di [02](./02-findings-p0-p3.md);
alasan memilih opsi ini alih-alih yang lain ada di [03](./03-options-tradeoffs.md).

## 1. Cakupan: apa yang mendarat di kode, apa yang masih rencana

| # | Perbaikan | Status | File utama |
|---|---|---|---|
| #1 | Batasi lompatan `StateEngine` | ⏳ **Rencana** — menunggu Ruby | `api/app/services/coverage/state_engine.rb` |
| #2 | Auto-advance tidak lagi mengarang `covered` | ⏳ **Rencana** — menunggu Ruby | `api/app/workers/coverage_analyzer_worker.rb` |
| #3 | `level` hilang → `unknown`, bukan L1 | ⏳ **Rencana** — menunggu Ruby | `api/app/services/portfolios/generator.rb` |
| #4 | Confidence kanonik: unknown ≠ LOW, medium ≠ confirmed | ✅ | `confidence.ts`, `ConfidenceIndicator.tsx`, `FitGapReportPage.tsx`, `SkillPortfolioCard.tsx` |
| #5 | `parseLevel` gagal ≠ 1 | ✅ | `constants.ts`, `LevelBadge.tsx`, `OverridePanel.tsx`, `LevelRadio.tsx` |
| #6 | `ai_level`: `string` → `number` | ✅ | `types/index.ts` |
| #7 | Error interview ≠ "Complete" | ✅ | `InterviewPage.tsx` (191 baris), `useAudioWebSocket.ts`, `types/index.ts` |
| #8 | `LevelRadio` id di-scope + `aria-label` | ✅ | `LevelRadio.tsx` + 4 pemanggil |
| #9 | Harness: test, typecheck, lint, CI | ✅ | `vite.config.ts`, `package.json`, `eslint.config.js`, `ci.yml`, `src/test/` |

Porsi FE:BE yang dikerjakan: **FE selesai, BE menunggu Ruby siap** — bukan BE diabaikan
(Klaster A #1–#3 adalah 2 dari 3 P0 yang kupilih jadi tema, dan keduanya sudah punya
keputusan arsitektur di [03](./03-options-tradeoffs.md)).

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

- **`api/` seluruhnya** — Ruby belum terpasang di lingkungan ini; menyentuh backend
  tanpa bisa menjalankan rspec justru melanggar aturan "jangan klaim apa pun yang tidak
  kamu jalankan". #1–#3 sudah punya keputusan arsitektur ([03](./03-options-tradeoffs.md)),
  tinggal dieksekusi begitu Ruby siap.
- **B3, B4, C1–C9, D4, E2, E3, S2** — alasan per temuan ada di [06](./06-not-done-and-why.md).
- **`web/src/components/ui/**`** (shadcn) — bukan target domain; juga dikecualikan dari
  coverage (`vite.config.ts` coverage `exclude`).
- **Tidak ada runtime dependency baru** — semua devDependency; `package-lock.json`
  masuk agar `npm ci` di CI deterministik.

## 10. Verifikasi per perbaikan

| # | Yang dijalankan | Hasil |
|---|---|---|
| #4 | `ConfidenceIndicator.test.tsx`, `DiscoveredSkillRow.test.tsx`, `SkillPortfolioCard.test.tsx`, `tsc` | ✅ (detail di [05](./05-testing.md)) |
| #5 | `constants.test.ts` (table-driven), `LevelRadio.test.tsx`, `OverridePanel.test.tsx`, `tsc` | ✅ |
| #6 | `tsc --noEmit` (memaksa semua konsumen kompilasi ulang) | ✅ bersih |
| #7 | `InterviewPage.test.tsx` (mock axios + WebSocket), `tsc` | ✅ — termasuk bukti MERAH→HIJAU |
| #8 | `LevelRadio.test.tsx` + `LevelRadio.a11y.test.tsx` | ✅ |
| #9 | `npm run test` (9 file / 46 test), `tsc --noEmit`, `npm run lint`, `npm run build` | ✅ 46/46, exit 0, exit 0 (17 warnings, 0 errors), sukses |

Bukti MERAH→HIJAU, 2 AI Verification Moment, dan tabel No Regression:
[05-testing.md](./05-testing.md).

---

> **[PERLU SUARAMU — sebelum defense, jawab ini dengan kata-katamu sendiri untuk tiap
> perbaikan yang sudah mendarat (#4–#9)]:**
> 1. *Apa yang akan rusak kalau kamu TIDAK melakukan perbaikan ini?* (kalimat dampak,
>    bukan kalimat teknis — untuk #7: "kandidat pulang yakin wawancaranya selesai,
>    padahal belum pernah mulai")
> 2. *Kenapa opsi ini dan bukan yang lain?* (baca [03](./03-options-tradeoffs.md) dulu,
>    lalu tutup — ceritakan ulang)
> 3. Satu detail yang bisa kamu tunjuk langsung di kode tanpa cari-cari (mis. #4: baris
>    `return "UNKNOWN"` di `confidence.ts`; #7: satu-satunya pemanggil
>    `onStateChange("complete")` di `useAudioWebSocket.ts`).
>
> Detail 3 bukan hiasan — itu yang membedakan "memahami kode ini" dari "membaca
> ringkasannya". Dan untuk #1–#3: sampai Ruby jalan, status jujurnya **rencana**, dan
> kamu harus bisa menjelaskan *mengapa menunggu Ruby* (tanpa rspec, perbaikan #1 tidak
> bisa dibuktikan — lihat [06](./06-not-done-and-why.md)).
