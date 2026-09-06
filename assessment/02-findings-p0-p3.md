# 02 — Temuan (P0–P3) + Bukti

**Metode:** audit baca kode langsung pada `api/` dan `web/` (bukan linter, bukan tebakan).
Semua `file:line` mengacu pada **state kode sebelum perbaikan** — setelah file
diperbaiki, nomor baris bisa bergeser. Setiap temuan di bawah sudah diverifikasi dengan
membuka file-nya; sebelum submit, verifikasi ulang satu per satu (kamu yang akan
ditanya di defense).

Total audit dua sisi: **backend ±12 P0 / 23 P1 / 21 P2 / 8 P3, frontend ±7 P0 / 14 P1 /
21 P2 / 9 P3**. Kita **tidak perlu dan tidak boleh** mengerjakan semuanya — yang dinilai
kualitas penalaran dan kedalaman perbaikan, bukan jumlah. Temuan dikelompokkan jadi 5 klaster.

Keterangan severity: **P0** = kesalahan/kebocoran yang berdampak langsung pada penilaian
atau data orang; **P1** = kegagalan yang menipu user atau melemahkan integritas;
**P2** = keamanan/robustness yang perlu tapi tidak langsung; **P3** = kebersihan & polish.

## Klaster A — Integritas penilaian (produk memberi rating yang salah pada manusia)

Bukan crash — **produk diam-diam menghasilkan angka yang salah, dan tidak ada yang tahu.**
Ini klaster yang kupilih jadi tema.

| ID | Temuan | Bukti (file:line) | Sev |
|---|---|---|---|
| A1 | State machine coverage bisa dilompati: `probe_count` yang sama dipakai ulang di **setiap langkah** loop, jadi satu panggilan dengan `probe_count == 2` mendorong `not_yet → initiated → partial → covered` sekaligus | `api/app/services/coverage/state_engine.rb` (loop `resolve_state`) | P0 |
| A2 | Auto-advance `partial → covered` di `probe_count >= 4` **tanpa penilaian AI**, lalu menimpa `last_signal` dengan string robot — portfolio generator mengutip kalimat itu sebagai *evidence* penilaian | `api/app/workers/coverage_analyzer_worker.rb:91-101` (juga `retry: 0` :6, `rescue` telanjang :32-34, read-modify-write tanpa lock :39-48) | P0 |
| A3 | `level` hilang dari respons AI → `nil.to_i` = 0 → `clamp(1,5)` = **L1** (rating terburuk); lolos validasi karena 1 nilai sah. File yang sama: `JSON.parse` tanpa penanganan rusak (:151), `destroy_all` tanpa lock (:154) | `api/app/services/portfolios/generator.rb:161` | P1 |
| A4 | Confidence "tidak diketahui" ditampilkan **LOW** (undefined jatuh ke `"LOW"`); pasangnya: `medium` di-render sebagai kata **"confirmed"** | `web/src/components/portfolio/ConfidenceIndicator.tsx:5-10`, `web/src/pages/fitgap/FitGapReportPage.tsx:196` | P1 |
| A5 | Pemilihan skill berikutnya pakai `min_by` → prioritas terbalik; plus shared secret `SYS-TC-7x9k` ditanam di dalam prompt | `map_injector.rb:105,109`, `system_prompt_compiler.rb:166` | P1 |

## Klaster B — Kegagalan senyap (wawancara hilang tanpa ada yang tahu)

| ID | Temuan | Bukti (file:line) | Sev |
|---|---|---|---|
| B1 | **Semua** error di fetch awal jadi layar "Interview Complete": token kedaluwarsa, 404, API mati — kandidat pulang yakin wawancara selesai, padahal belum pernah mulai. **Nuansa penting:** halaman ini *punya* resiliensi (timer 60 dtk `connectionLostTimerRef` :74-76, timer `draining_audio` :65-67, state `reconnecting`, guard `audioCompleteCalledRef` :101-109) — cacatnya spesifik: satu terminal `.catch` meruntuhkan semua kelas error ke state yang terlihat seperti sukses | `web/src/pages/interview/InterviewPage.tsx:51` | P0 |
| B2 | Reconnect menyerah setelah ~7 detik (`[1000, 2000, 4000]`), lalu sesi dianggap selesai. `onStateChange("complete")` dipanggil di **tiga** tempat: `session_ended` (:103, satu-satunya yang jujur), `case "error"` non-recoverable (:106), reconnect habis (:130) | `web/src/hooks/useAudioWebSocket.ts:119-132` | P1 |
| B3 | Form assessment: fetch gagal → `.catch(() => {})` diam, form tampil kosong, user klik Save → data valid tertimpa kosong; payload juga tidak menyertakan `language` | `web/src/pages/.../AssessmentEditPage.tsx:41,54-55,77-81` | P1 |
| B4 | Hardware check selalu lulus: step 1 hanya `setTimeout` 800 ms yang **selalu PASS** dan hasilnya dibuang; 3 promise chain tanpa `.catch`. Diperparah `vercel.json` mematikan camera via `Permissions-Policy` + CSP memblok endpoint speed test → ping **999 dikarang** | `HardwareCheck.tsx:106-118,123,147,170`, `web/vercel.json:11,14`, `web/src/utils/internetSpeedTest.ts:52` | P1 |

## Klaster C — Isolasi tenant gagal terbuka (fail-open)

**Severity tertinggi secara absolut di seluruh audit — tapi tidak kupilih jadi tema**
(koordinasi lintas-repo, lihat [06-not-done-and-why.md](./06-not-done-and-why.md)).

| ID | Temuan | Bukti (file:line) | Sev |
|---|---|---|---|
| C1 | `scheme` diambil dari **header yang dikirim client** (`X-Tenant-Scheme`), fallback organisasi pertama / `test-corp`; tabel `users` global tanpa `tenant_id` → kredensial admin mana pun bisa mencetak token organisasi mana pun | `api/app/controllers/api/v1/authentication_controller.rb:24-29` | P0 |
| C2 | `default_scope` mengembalikan **`all`** kalau tenant nil (fail-open); di jalur WebSocket & Sidekiq tenant sering nil → query mengembalikan seluruh data semua tenant | `api/app/models/concerns/tenant_scoped.rb:18-24` | P0 |
| C3 | Hanya **3 dari 16** model menyertakan `TenantScoped` → IDOR di portfolios, portfolio skills, export PDF, fit-gap worker. *(Catatan jujur: `SkillTaxonomy` memang di-seed global — pengecualian sah, bukan salah.)* | `portfolios_controller.rb:82,104,130,156`, `portfolio_skills_controller.rb:50-52`, `exports/pdf_generator.rb:24`, `fit_gap_generator_worker.rb:9-10` | P0 |
| C4 | Middleware tenant mendekode JWT **tanpa verifikasi**, lalu jatuh ke header client, lalu ke `Referer`, semuanya di-`rescue` jadi nil | `api/app/middleware/tenant_resolver_middleware.rb:33-51` | P1 |
| C5 | WebSocket coverage tanpa cek role → kandidat bisa menyadap channel monitor recruiter | `coverage_websocket_middleware.rb:125-137` | P1 |
| C6 | Penghitung turn di memori proses; `rescue RecordNotUnique` membuang turn duplikat **tanpa jejak** | `audio_websocket_middleware.rb:116,649-655` | P2 |
| C7 | PII (transkrip wawancara) masuk log; **tidak ada `filter_parameters` sama sekali** di seluruh konfigurasi — kaitan langsung kepatuhan UU PDP | `live_client.rb:288,292,297`, `http_client.rb:78` | P1 |
| C8 | Migrasi `down` menjatuhkan schema **CASCADE** — satu `db:rollback` di environment salah = seluruh schema `ai_interview` lenyap (DB ini dibagikan dengan `rakamin-api`) | `db/migrate/20240101000000_create_ai_interview_schema.rb:235-237` | P2 |
| C9 | `seeds.rb` memakai raw SQL dengan interpolasi string — input konstanta jadi tidak eksploitabel *hari ini*, tapi polanya tidak boleh dicontoh | `api/db/seeds.rb` | P3 |

## Klaster D — Tidak ada jaring pengaman sama sekali

| ID | Temuan | Bukti | Sev |
|---|---|---|---|
| D1 | `api/.rspec` ada (`--require spec_helper`) tapi **folder `spec/` tidak ada** → `rspec` tidak bisa boot. Padahal `Gemfile` sudah mendeklarasikan `rspec-rails ~> 6.0`, `factory_bot_rails`, `faker`, `database_cleaner`, `timecop`, `rubocop` + `rubocop-rails` + `rubocop-rspec`. Menambah test = **mengaktifkan yang sudah dipilih tim**, bukan keputusan dependensi baru | `api/.rspec`, `api/Gemfile` | P1 |
| D2 | `web/package.json` scripts awal hanya `dev`, `build`, `preview` — tidak ada test, lint, format, dan tidak ada vitest/jest/eslint/prettier di devDependencies | `web/package.json` | P1 |
| D3 | **Nol CI** — tidak ada `.github/` di repo | (ketiadaan) | P1 |
| D4 | `web/tsconfig.json` tanpa `noUncheckedIndexedAccess` | `web/tsconfig.json:19-22` | P2 |
| D5 | Tipe tidak konsisten: `PortfolioSkill.ai_level: string` vs `AssessorOverride.ai_level: number`; `parseLevel` mengembalikan **1** saat gagal (bug A3 versi frontend) | `web/src/types/index.ts:88-107`, `web/src/utils/constants.ts:4-8` | P1 |
| D6 | `zod ^4.3.6` + `@hookform/resolvers ^5.2.2` sudah terpasang tapi tidak dipakai | `web/package.json` | P3 |

## Klaster E — UI/UX & aksesibilitas (porsi Product Team)

| ID | Temuan | Bukti | Sev |
|---|---|---|---|
| E1 | Label radio bocor antar-skill: `id`/`htmlFor` dari `level-${level}` saja → id bertabrakan global di `.map()`; klik label skill #2 mengubah nilai skill #1. Tanpa `aria-label` | `web/src/components/assessment/LevelRadio.tsx:23-24` (dipakai di `SkillCard.tsx:103`, `VacancyNewPage.tsx:91`, `VacancyEditPage.tsx:80`) | P1 |
| E2 | Aksesibilitas hampir nol: grep `aria-|role=|sr-only|tabIndex|onKeyDown` di seluruh `web/src` hanya **3** kecocokan — di produk yang dipakai untuk keputusan rekrutmen | grep `web/src` | P2 |
| E3 | Nyaris tidak ada responsive: hanya **satu** class breakpoint di kode aplikasi, padahal kandidat ikut wawancara dari HP | `AssessmentInvitePage.tsx:231` | P2 |

## Temuan setup (ditemukan saat Step 1)

| ID | Temuan | Bukti | Sev |
|---|---|---|---|
| S1 | `web/.env.example` menunjuk port **3000**, padahal API di **3001** → aplikasi mati sejak layar pertama | `web/.env.example`, `api/Dockerfile` (EXPOSE 3001) | P2 |
| S2 | `api/README.md` step 7 menyuruh `cd ../ai-interview-web` — path sisa zaman dua-repo (yang benar `../web`); env `GEMINI_ANALYSIS_MODEL` di README vs `GEMINI_FLASH_MODEL` di `application.yml.sample`; `ALLOWED_ORIGINS: "*"` di sample | `api/README.md`, `api/config/application.yml.sample` | P3 |

## Irisan vertikal yang kupilih (9 perbaikan)

Tabel 9 perbaikan + status ada di [README.md](./README.md) — ringkasannya: **Klaster A +
B1/B2**, dibungkus satu kalimat masalah, ditutup harness. Porsi FE:BE ≈ 60:40 sesuai
posisi yang dilamar, tanpa "ketiadaan total" di backend. Klaster C disebut sebagai P0
dengan rekomendasi arsitektur, **bukan** ditambal setengah jalan.

## Pola bagus yang sudah ada — diikuti, bukan bikin gaya baru

- `TranscriptPage.tsx:25,68-88` — pola loading/error/empty/ready lengkap, key stabil →
  dijadikan standar saat memperbaiki halaman lain.
- `AssessmentListPage.tsx:53-69`, `VacancyListPage.tsx:32-48` — pola fetch yang benar.
- `OverridePanel.tsx` — pola form/override yang rapi.
- `web/src/services/api.ts:14-18,24-26` — interceptor axios yang sudah ada.
- `web/vite.config.ts:9,15-19` — `manualChunks` sudah dikonfigurasi.

> **[PERLU SUARAMU:** (1) verifikasi ulang tiap `file:line` di atas dengan membuka
> file-nya sendiri sebelum submit — ini yang dipertanyakan di defense. (2) severity
> P0–P3 di atas adalah analisis awal; kalau kamu melihat perbedaan penilaian, sesuaikan
> dan tulis alasannya. (3) angka total audit (±12 P0/23 P1/…) berasal dari hitungan
> manual audit — sebut sebagai "±", jangan sebagai angka eksak.]
