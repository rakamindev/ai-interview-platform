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

### 4b. Sisi backend (A1) — rencana, menunggu Ruby

Pakai temuan A1 (`state_engine.rb`). Prosedurnya:

1. Perbaiki `resolve_state` (maksimal satu state maju per panggilan — opsi B di [03](./03-options-tradeoffs.md)), jalankan `rspec` → **HIJAU**. Screenshot.
2. Sengali rusak kembali: kembalikan loop-nya agar memakai `probe_count` yang sama di
   setiap langkah (persis kode asli). `rspec` → **MERAH**; pastikan pesan gagal menyebut
   skill naik ke `covered` padahal probe baru 2. Screenshot.
3. Kembalikan perbaikan → **HIJAU** lagi. Screenshot.

Tiga screenshot masuk laporan berurutan. (Prasyaratnya sendiri sudah ada di repo:
`Gemfile` sudah mendeklarasikan `rspec-rails ~> 6.0` +全套 dukungan — menambah test adalah
mengaktifkan yang sudah dipilih tim, lihat temuan D1.)

## 5. AI Verification Moment (standar brief) — dua kasus yang benar-benar terjadi

Brief meminta momen di mana klaim AI diverifikasi sendiri dan **ternyata meleset**.
Dua di bawah bukan rekonstruksi — keduanya tercatat saat kejadian.

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

> **[PERLU SUARAMU:** ceritakan kedua momen ini dengan kalimatmu sendiri di video/defense —
> struktur "AI bilang X → saya cek sendiri → ternyata Y → kesimpulan saya berubah". Kalau
> kamu punya momen versimu sendiri, pakai yang itu; yang penting bentuknya, bukan kasusnya.]

## 6. No Regression (standar brief)

**Yang sudah benar-benar dijalankan — dan hanya ini yang boleh diklaim:**

| Perintah | Hasil | Catatan |
|---|---|---|
| `npm test` (`vitest run`) | `Test Files 9 passed (9)` / `Tests 46 passed (46)` | naik dari 41 setelah #7; tidak ada spec lama yang diubah |
| `npm run typecheck` (`tsc --noEmit`) | bersih, exit 0 | mengunci perbaikan #6 (semua konsumen `ai_level` dikompilasi ulang) |
| `npm run lint` (`eslint .`) | exit 0 — **0 errors, 17 warnings** | sisa warning (unused var, `any`) di file di luar scope perbaikan; dirapikan bertahap |
| `npm run build` (`tsc && vite build`) | bersih, exit 0 | 1844 modul, 579 kB JS total (4 chunk, gzip 186 kB) |
| `rspec` / `rubocop` / `brakeman` | **belum dijalankan** | Ruby 3.3.2 + PostgreSQL belum terpasang — blocker #1–#3 |
| CI GitHub Actions | workflow **sudah dibuat** di root repo; **belum pernah hijau** (belum di-push) | `typecheck → lint → test → build`; screenshot CI hijau masuk laporan setelah push |

Kolom "belum dijalankan" ditulis apa adanya: menuliskannya jauh lebih aman daripada
mengklaim suite backend hijau. CI-nya adalah bukti No Regression yang *berkelanjutan* —
setiap PR berikutnya harus melewati 4 step yang sama.

## 7. Observability — bagian yang sudah mendarat di frontend

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
- **Masih rencana (butuh Ruby):** `Rails.logger.warn` terstruktur (`session_id`,
  `skill_id`, alasan) di jalur A2/A3; ganti `retry: 0` di worker dengan retry terbatas
  + jalur dead-letter yang tercatat; `config.filter_parameters` agar log baru tidak
  menambah kebocoran PII (kaitan UU PDP → [06](./06-not-done-and-why.md)).

---

> **[PERLU SUARAMU — sebelum submit, lakukan sendiri dan catat:**
> 1. Jalankan `npm test` **sendiri sekali** (di mesinmu) dan baca outputnya — kamu akan
>    ditanya "berapa test-mu, apa yang mengunci #7?" dan jawabannya harus terasa milikmu.
> 2. Ulangi seeded fault §4a sendiri (1 baris, 2× `npm test`) supaya kamu bisa
>    menampilkannya live kalau diminta.
> 3. Rekam 1–2 menit layar: suite hijau → tanam fault → merah → balik → hijau. Ini masuk
>    video (slot 2:30–3:30 di struktur video, brief Step 6).
> 4. Untuk #1–#3: siap ditebak "belum dites" — jawaban jujurnya sudah ada di [06](./06-not-done-and-why.md).]
