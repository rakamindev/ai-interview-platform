# 05 — Testing: Bukti yang Dijalankan

> **Aturan dokumen ini:** setiap angka di bawah adalah output yang **benar-benar
> dijalankan** di lingkungan ini. Yang belum bisa dijalankan (Ruby) ditulis eksplisit
> "belum dijalankan" — brief menghitung klaim palsu sebagai alasan gugur (disqualifier #6),
> jadi kolom "belum" bukan kelemahan laporan; itulah laporan.

## 1. Harness (detail di [04 §2](./04-implementation.md))

- **vitest 3.2.7** + jsdom 25 + `@testing-library/react` 16 + `jest-dom` + `user-event`,
  semua devDependency.
- Konfigurasi test **di dalam `vite.config.ts`** — bukan `vitest.config.ts` (yang akan
  mengabaikan `vite.config.ts` dan menghapus alias `@`).
- `src/test/setup.ts`: matcher jest-dom + `cleanup()` per test.
- Hasil akhir: **`Test Files 9 passed (9)` / `Tests 46 passed (46)`**, exit 0.
  (Kini 47 — +1 test negatif `ai_level: null` dari jahitan perbaikan #3.)

### 1b. Harness backend (dibootstrap di Docker — detail di [04 §2b](./04-implementation.md))

- `spec/` di-bootstrap dari nol (D1): `spec_helper`, `rails_helper`, `spec/support/
  factory_bot.rb`, `spec/factories.rb` — memakai `rspec-rails` + `factory_bot_rails`
  yang **sudah dideklarasikan Gemfile sejak awal**.
- Runtime: Ruby 3.3.2 di container (`api/Dockerfile.dev`), PostgreSQL 16 (`aiint-pg`)
  dan Redis 7 (`aiint-redis`) sebagai container di network yang sama. Database test:
  `rakamin_test` (schema `ai_interview` + `public`).
- Hasil akhir: **`43 examples, 0 failures`** — detail per file di §4b dan §2b 04.

## 2. Apa yang dikunci tiap file test

| File | Test | Mengunci perilaku | Perbaikan |
|---|---|---|---|
| `utils/constants.test.ts` | 8 | table-driven `parseLevel`: `3`/`"3"`/`"L3"` → 3; `"3.5"`/`"abc"`/`""`/`null`/`0`/`6` → **null** (bukan 1) | #5 |
| `portfolio/ConfidenceIndicator.test.tsx` | 5 | 4 cabang label + **2 test negatif**: confidence hilang / tidak dikenal **tidak boleh** dirender "LOW" | #4 |
| `fitgap/DiscoveredSkillRow.test.tsx` | 5 | high = "confirmed"; **medium tidak boleh "confirmed"**; confidence hilang tidak boleh "confirmed" | #4 |
| `portfolio/SkillPortfolioCard.test.tsx` | 3 | catatan low-confidence muncul tepat saat low; **ketiadaan confidence menampilkan catatan "unverified"**, bukan catatan low | #4 |
| `assessment/LevelRadio.test.tsx` | 4 | pilih/ubah nilai; `value = null` → **tidak ada radio terisi** (angka karangan dilarang) | #5, #8 |
| `assessment/LevelRadio.a11y.test.tsx` | 5 | id unik antar instance di `.map()`; `aria-label` terpasang; **klik label skill #2 tidak mengubah skill #1** | #8 |
| `portfolio/OverridePanel.test.tsx` | 5 | simpan hanya jika level dipilih; level AI hilang → tombol mati + penjelasan; jalur normal tetap bekerja | #5 |
| `portfolio/LevelBadge.test.tsx` | 6 | L1–L5 me-render label + deskripsi; `null`/di luar rentang → kotak "Unknown" putus-putus, **bukan** kotak kosong | #5 |
| `pages/interview/InterviewPage.test.tsx` | 5 | kegagalan tidak boleh tampil sebagai sukses (detail di §3) | #7 |

**46 test.** Test negatif (baris tebal) sengaja lebih berharga dari test positif: mereka
yang akan merah kalau bug-nya kembali.

## 3. #7 — MERAH → HIJAU (standar *Proven Correctness*)

`InterviewPage.test.tsx` ditulis **terlebih dulu, terhadap kode yang masih rusak** — jadi
merahnya bukan hasil merusak ulang, melainkan kondisi asli repo. Itu membuatnya lebih kuat
daripada seeded fault biasa.

Lima kasus:
1. token kedaluwarsa → tidak mengucapkan selamat, dan **menyebut alasannya**
2. layar error menyediakan jalan keluar (`Try again`)
3. tombol coba lagi benar-benar memanggil API kedua kali dan memulihkan layar
4. `session_status: "ended"` **tetap** menampilkan "Interview Complete" (guard kebalikan)
5. reconnect habis di tengah wawancara → **koneksi hilang, bukan wawancara selesai**

| Tahap | Hasil | Bukti |
|---|---|---|
| MERAH (sebelum perbaikan) | `Tests 4 failed \| 1 passed (5)` | DOM saat gagal menampilkan ✅ + "Interview Complete" + "The interview has been recorded." untuk token yang **404 "Invalid or expired invite token"** |
| HIJAU (sesudah perbaikan) | `Tests 5 passed (5)` | `InterviewPage.tsx` + `useAudioWebSocket.ts` |
| No Regression | `Test Files 9 passed (9)` / `Tests 46 passed (46)` | naik tepat **5** dari baseline 41 — tidak ada spec lama yang perlu disesuaikan |

**Dua hal yang layak ditunjukkan di defense:**

- **Kasus 4 adalah satu-satunya yang hijau sejak awal** — dan itu memang tujuannya.
  Perbaikan yang kebablasan (mengubah semua jalur pra-wawancara jadi error) akan membuatnya
  merah. Guard kebalikan seperti ini yang membedakan test yang *mengunci perilaku* dari
  test yang sekadar mengejar angka hijau.
- **Kasus 3 hampir lolos dengan implementasi yang salah.** `setInterviewState("idle")`
  tanpa syarat membuat kelima test hijau, tapi tetap keliru: fetch yang resolve terlambat
  bisa menarik wawancara yang sudah berjalan kembali ke layar pembuka. Bentuk yang dipakai:
  functional updater — `prev === "error" ? "idle" : prev` (terlihat di
  `InterviewPage.tsx`, jalur `.then` fetch). Kalau ditanya "apakah test-mu cukup": untuk
  kasus ini **tidak** — yang menutup celahnya adalah membaca alur state-nya sendiri.

## 4. Seeded Fault Test (standar brief)

### 4a. Sisi frontend — **sudah dijalankan** (output di bawah asli)

**Fault (1 baris):** `web/src/utils/confidence.ts`, kasus `default` di
`toConfidenceLabel()` — kembali ke perilaku lama persis seperti bug A4 asli:

```diff
     default:
-      return "UNKNOWN";
+      return "LOW";
```

**Prosedur & hasil:**

| Tahap | Perintah | Hasil |
|---|---|---|
| Baseline | `npm test` | `Test Files 9 passed (9)` / `Tests 46 passed (46)`, exit 0 |
| **MERAH** | `npm test` (dengan fault) | **`Test Files 3 failed \| 6 passed (9)` / `Tests 4 failed \| 42 passed (46)`, exit 1** |
| HIJAU kembali | fault dibalik, `npm test` | `Test Files 9 passed (9)` / `Tests 46 passed (46)`, exit 0 |

Empat test yang merah tersebar di **tiga file berbeda**:
- `ConfidenceIndicator.test.tsx` — 2 test "tidak boleh mengklaim LOW ketika confidence
  tidak ada / tidak dikenal" (render jadi "Confidence: LOW");
- `DiscoveredSkillRow.test.tsx` — "tidak boleh menyebut confidence yang hilang sebagai
  confirmed" (jadi "low confidence" alih-alih "confidence not available");
- `SkillPortfolioCard.test.tsx:55` — catatan *"Confidence data is missing… treat the level
  above as unverified"* tidak muncul.

**Kenapa fault ini berguna:** satu baris di **satu titik kanonik** menjatuhkan tiga layar
berbeda — persis jalur sebar bug A4 aslinya. Kalau perbaikan #4 cuma menambal satu
komponen, seeded fault ini akan merah di satu file saja; ternyata merah di tiga,
membuktikan fungsi kanoniknya memang yang mengunci perilaku.

**Kebersihan:** fault tidak pernah di-commit — hanya hidup sementara di working tree,
dibalik dengan edit terbalik, dan working tree diverifikasi kembali hijau (46/46).
Di laporan, fault-nya cukup didokumentasikan dengan diff di atas + tiga screenshot
(MERAH baseline → MERAH fault → HIJAU) — **jangan tinggalkan commit fault di branch final**.

### 4b. Sisi backend (A1) — **sudah dijalankan** (output di bawah asli)

Prosedurnya dibalik dari FE: fault **di-commit** dulu, dirun merah, lalu di-revert —
sehingga siklusnya terlihat di history branch (`git log`:

```
20a47b0 Revert "test: seeded fault — kembalikan loop multi-rung StateEngine yang asli"
52be6c3 test: seeded fault — kembalikan loop multi-rung StateEngine yang asli
```

):

| Tahap | Perintah | Hasil |
|---|---|---|
| Baseline HIJAU | `RAILS_ENV=test bundle exec rspec` | **`43 examples, 0 failures`** |
| **MERAH** (fault di-commit `52be6c3`) | `rspec spec/services/coverage/state_engine_spec.rb` | **`7 examples, 2 failures`** — persis dua kasus "melompat tangga": *hanya maju SATU state per panggilan* dan *tetap maju satu state yang sah* (loop asli mendorong `initiated → covered` dalam satu panggilan) |
| HIJAU kembali (revert `20a47b0`) | `rspec` (suite penuh) | **`43 examples, 0 failures`** |

**Bukti migrasi reversibel (#3)** — klaim di file migrasi diuji, bukan diasumsikan:

```
RAILS_ENV=test rails db:rollback STEP=1  →  "== RelaxPortfolioSkillsAiLevel: reverted =="
grep schema.rb                          →  ai_level kembali null: false (2 kolom)
RAILS_ENV=test rails db:migrate         →  "== RelaxPortfolioSkillsAiLevel: migrated =="
schema.rb                               →  t.integer "ai_level" (nullable) + CHECK diperluas
```

Catatan jujur tentang dua kegagalan yang terjadi di perjalanan (bukan sesuatu yang
disembunyikan): (1) `db:prepare` awal memuat schema dari `schema.rb` lama sehingga spec
generator merah dengan `PG::NotNullViolation` — `db:migrate` menyelesaikannya; (2) versi
pertama migrasi memakai `drop_check_constraint` — method yang **tidak ada** di Rails 7.0
(yang benar `remove_check_constraint`), ketangkapannya langsung dari `db:migrate`, bukan
dari test.

**Environment backend yang dipakai:** Ruby 3.3.2 di Docker (`api/Dockerfile.dev`, gems
di-bake, source di-mount), PostgreSQL 16 + Redis 7 sebagai container (`aiint-pg`,
`aiint-redis`). RSpec: 5 file spec (StateEngine, LevelParser, Generator, model
PortfolioSkill, worker CoverageAnalyzer) + 3 file bootstrap (spec_helper, rails_helper,
factory_bot).

## 5. AI Verification Moment (standar brief) — tiga kasus yang benar-benar terjadi

Brief meminta momen di mana klaim AI diverifikasi sendiri dan **ternyata meleset**.
Tiga di bawah bukan rekonstruksi — semuanya tercatat saat kejadian.

**Momen 1 — klaim audit yang salah (diubah oleh verifikasi):**

> Audit awal menyimpulkan `InterviewPage.tsx` "tidak punya penanganan kegagalan
> koneksi". Setelah membaca baris 30–109 sendiri, itu **tidak akurat**: halaman itu
> punya timer `connectionLostTimerRef` 60 detik, timer aman `draining_audio` 10 detik,
> state `reconnecting`, dan guard `audioCompleteCalledRef`. Cacat sebenarnya jauh lebih
> sempit: **satu `.catch` terminal** pada fetch awal yang meruntuhkan semua kelas error ke
> state `complete`. Deskripsi masalah berubah — dari "tidak ada resiliensi" menjadi
> "resiliensi ada, tapi jalur error awal salah diklasifikasi sebagai sukses" — dan
> perbaikannya berubah: bukan menulis mekanisme retry baru, tapi memisahkan kelas error
> dan menyambungkannya ke mekanisme yang **sudah ada**.

**Momen 2 — angka test yang menipu:**

> Setelah perbaikan #7 ditulis, suite dijalankan: `4 failed | 1 passed` — **tally yang
> sama persis dengan kondisi MERAH sebelum perbaikan**. Kesimpulan gampangnya: perbaikan
> tidak berpengaruh. Yang berubah bukan jumlahnya, tapi **alasannya**: dari gagal
> assertion menjadi `ReferenceError: AlertTriangle is not defined`. Satu edit pada baris
> import `lucide-react` ternyata tidak tersimpan meski tool-nya melaporkan sukses, jadi
> JSX baru memakai ikon yang tidak pernah diimpor. Penyebabnya dipersempit dengan
> eliminasi, bukan tebakan: tidak ada test yang me-mock `lucide-react`, kedua ikon memang
> diekspor di versi 0.511.0, `vite.config.ts` tidak menyentuh ikon, dan komponen sebelah
> (`ConfidenceIndicator`, import `AlertCircle`) test-nya hijau — tersisa hanya baris
> import itu sendiri.
>
> Pelajaran: **angka hijau/merah bukan sinyal yang cukup; teks kegagalannya yang harus
> dibaca.** Dan "sukses" dari tooling bukan bukti perubahan benar-benar mendarat.

Momen 2 bagus dipakai kalau interviewer bertanya "bagaimana kamu memverifikasi kerja
AI?" — jawabannya konkret dan bisa ditunjukkan: isinya `ReferenceError`, bukan assertion.

**Momen 3 — "hijau kemarin" bukan bukti hijau hari ini (environment bergeser):**

> Saat verifikasi ulang sebelum submit, suite frontend yang sebelumnya tercatat hijau
> 46/46 tiba-tiba gagal di-load: `TypeError: localStorage.getItem is not a function` di
> `SkillPortfolioCard.test.tsx` — tanpa satu pun assertion yang berubah. Root cause bukan
> di kode yang dites: Node ≥ 22 mengekspos global `localStorage` miliknya sendiri, dan di
> environment jsdom versi Node yang baru menimpa `localStorage` jsdom dengan stub Node
> yang kosong (diverifikasi dengan probe test kecil: `typeof localStorage.getItem →
> "undefined"` + warning `--localstorage-file was provided without a valid path`).
> Perbaikannya ada di test setup, bukan di kode aplikasi: `src/test/setup.ts` memasang
> in-memory Storage hanya jika implementasi yang ada tidak benar — suite kembali 46/46.
>
> Pelajaran: **hasil test adalah fungsi dari environment-nya.** Suite yang "pernah hijau"
> harus dirun ulang di environment aktual sebelum diklaim; dan fix yang benar untuk
> kegagalan seperti ini ditaruh di sumber yang tepat (setup test), bukan mengejar error
> di file yang kebetulan terderevensi.

> **[PERLU SUARAMU:** ceritakan momen-momen ini dengan kalimatmu sendiri di video/defense —
> struktur "AI bilang X → saya cek sendiri → ternyata Y → kesimpulan saya berubah". Kalau
> kamu punya momen versimu sendiri, pakai yang itu; yang penting bentuknya, bukan kasusnya.]

## 6. No Regression (standar brief)

**Yang sudah benar-benar dijalankan — dan hanya ini yang boleh diklaim:**

| Perintah | Hasil | Catatan |
|---|---|---|
| `npm test` (`vitest run`) | `Test Files 9 passed (9)` / `Tests 47 passed (47)` | 46 setelah #7, +1 test negatif `ai_level: null` di DiscoveredSkillRow dari jahitan #3; tidak ada spec lama yang diubah |
| `npm run typecheck` (`tsc --noEmit`) | bersih, exit 0 | mengunci perbaikan #6 + kontrak baru `ai_level: number \| null` |
| `npm run lint` (`eslint .`) | exit 0 — **0 errors, 17 warnings** | sisa warning (unused var, `any`) di file di luar scope perbaikan; dirapikan bertahap |
| `npm run build` (`tsc && vite build`) | bersih, exit 0 | 1844 modul, 579 kB JS total (4 chunk, gzip 186 kB) |
| `RAILS_ENV=test bundle exec rspec` | **`43 examples, 0 failures`** | 5 file spec; jalan di Docker ruby 3.3.2 + Postgres 16 + Redis 7 |
| `rails db:rollback STEP=1` → `db:migrate` | reverted → migrated, schema.rb balik-benar | bukti reversibilitas migrasi #3 |
| Seeded fault BE | MERAH `7 examples, 2 failures` → revert → HIJAU `43/0` | commit fault + revert terlihat di history |
| `rubocop` / `brakeman` | **belum dijalankan** | lintas codebase lama = keputusan tim (lihat [06](./06-not-done-and-why.md)); bukan blocker yang tersisa |
| CI GitHub Actions | workflow **sudah dibuat** di root repo: job `web` (typecheck → lint → test → build) + job `api` (Postgres/Redis services → `db:prepare` → `rspec`); **belum pernah jalan** (belum di-push) | screenshot CI hijau masuk laporan setelah push |

Kolom "belum dijalankan" ditulis apa adanya: menuliskannya jauh lebih aman daripada
mengklaim suite backend hijau. CI-nya adalah bukti No Regression yang *berkelanjutan* —
setiap PR berikutnya harus melewati semua step yang sama.

## 7. Observability — yang sudah mendarat di frontend dan backend

Standar Observability brief: setiap kegagalan senyap yang diperbaiki harus meninggalkan
sinyal yang bisa dilihat manusia.

- **Sudah mendarat (#7):** state `error` dan `connection_lost` **berbeda secara visual**
  dari state sukses (bukan varian warna dari "Complete"), dan pesannya bisa
  ditindaklanjuti: alasan dari server untuk `error`; *"jawaban yang sudah diberikan tidak
  hilang"* + tombol Reconnect untuk `connection_lost`. Kegagalan sekarang *mengumumkan*
  dirinya.
- **Sudah mendarat (#4/#5):** data hilang punya UI sendiri ("not available", kotak
  "Unknown", catatan "unverified") — integritas juga soal tidak menyembunyikan ketiadaan
  data.
- **Sudah mendarat (#2, backend):** skill partial yang keluar dari context window tidak
  lagi dikarang jadi `covered` — kestagnannya dilaporkan lewat `Rails.logger.warn`
  terstruktur (`session_id`, `coverage_map_id`, `skill_label`, `probe_count`) yang
  dikunci oleh spec worker.
- **Masih rencana:** ganti `retry: 0` di worker dengan retry terbatas + jalur
  dead-letter yang tercatat; `config.filter_parameters` agar log baru tidak menambah
  kebocoran PII (kaitan UU PDP → [06](./06-not-done-and-why.md)).

---

> **[PERLU SUARAMU — sebelum submit, lakukan sendiri dan catat:**
> 1. Jalankan `npm test` **sendiri sekali** (di mesinmu) dan baca outputnya — kamu akan
>    ditanya "berapa test-mu, apa yang mengunci #7?" dan jawabannya harus terasa milikmu.
> 2. Ulangi seeded fault §4a dan §4b sendiri supaya kamu bisa menampilkannya live kalau
>    diminta (FE: 1 baris `toConfidenceLabel`; BE: revert commit fault `52be6c3`).
> 3. Rekam 1–2 menit layar: suite hijau → tanam fault → merah → balik → hijau. Ini masuk
>    video (slot 2:30–3:30 di struktur video, brief Step 6).
> 4. Untuk BE: bisa dijalankan ulang dengan `docker compose`-less setup di
>    `api/Dockerfile.dev` — pahami urutannya (postgres/redis container →
>    `db:prepare` → `rspec`) karena hampir pasti ditanya "spec-mu jalan di mana?".]
