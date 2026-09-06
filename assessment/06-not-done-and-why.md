# 06 — Yang Tidak Saya Kerjakan, dan Kenapa

**Aturan:** setiap baris di dokumen ini adalah sesuatu yang **tidak** dilakukan di case
study ini — beserta alasannya. Dokumen ini ada supaya dokumen lain tetap jujur:
04 dan 05 hanya berisi hal yang benar-benar dijalankan (dan diverifikasi); apa pun yang
hanya berupa rekomendasi atau rencana, tercatat di sini, dipisahkan dengan jelas.

Ringkasan:

| Item | Status | Kenapa |
|---|---|---|
| #1–#3 (A1, A2, A3) | ✅ **dieksekusi + dites** (lihat [04](./04-implementation.md) §2.5–2.7) | bukan lagi item "belum" — blocker Ruby diatasi lewat Docker |
| Klaster C (C1–C9) | **Rekomendasi tertulis, tanpa kode** | Arsitektur lintas-repo; menambal setengah jalan lebih berbahaya daripada tidak menambal |
| B3, B4 | Tidak diperbaiki | Scope 9 perbaikan ditetapkan tema (A + B1/B2) + harness |
| D4, D6 | Tidak disentuh | Perubahan program penuh / keputusan desain tim, bukan footnote |
| E2, E3 | Tidak diperbaiki | Program, bukan patch |
| S2 | Tidak diperbaiki | Doc-fix di repo yang bukan deliverable utama |
| `rubocop` / `brakeman` | **Belum dijalankan** | lint atas codebase lama yang belum pernah di-lint = keputusan tim soal gaya, bukan bagian tema |
| `retry: 0` / rescue telanjang / lock di worker | Tidak disentuh | keputusan desain job queue; tema integritas #2 hanya menghapus pengarangan data |
| CI di GitHub | Workflow **dibuat** (2 job: web + api), **belum pernah jalan** | Repo belum di-push |

---

## 1. #1–#3 — ~~inti tema, tapi tidak dieksekusi~~ SEKARANG SUDAH

**Status awal catatan ini (dipertahankan agar narasinya jujur):** tiga perbaikan inti
backend sempat tertahan karena tidak ada Ruby yang jalan di environment kerja — memperbaiki
A1–A3 tanpa bisa menjalankan spec-nya berarti melakukan persis hal yang brief larang:
mengklaim sesuatu yang tidak dijalankan.

**Cara blocker-nya diatasi:** bukan dengan mengklaim, tapi dengan membangun environment
yang bisa menjalankan buktinya — Ruby 3.3.2 + bundle lengkap di Docker
(`api/Dockerfile.dev`), PostgreSQL 16 + Redis 7 sebagai container, `spec/` di-bootstrap
dari nol (rspec-rails + factory_bot yang sudah dideklarasikan Gemfile sejak awal), dan
database test di-prepare dari migrasi. Setelah itu ketiganya dieksekusi sesuai opsi yang
dipilih di [03](./03-options-tradeoffs.md):

- **A1** — `resolve_state` maksimal satu state maju per panggilan (opsi B) → 10 contoh
  table-driven hijau + seeded fault: commit fault → MERAH `7 examples, 2 failures` →
  revert → HIJAU `43/0` (history branch: `52be6c3` → `20a47b0`).
- **A2** — auto-advance tidak menulis `covered`, tidak menyentuh `last_signal`, log
  terstruktur (opsi B) → spec worker mengunci ketiganya dengan DB nyata.
- **A3** — `Portfolios::LevelParser` + migrasi nullable dengan `down` yang dijaga
  (opsi B) → 19 kasus parse table-driven + spec generator DB nyata + bukti reversibilitas
  (`db:rollback` → `db:migrate`) + jahitan FE `ai_level: number | null`.

## 2. Klaster C — P0 tertinggi secara absolut, sengaja tidak disentuh

02-findings sudah menyatakan ini; di sini ditulis ulang sebagai **keputusan**, bukan
karena tidak tahu. C1–C3 (scheme dari header client, fail-open `all`, hanya 3 dari 16
model `TenantScoped`) adalah temuan paling serius di seluruh audit — tapi tema yang
dipilih tetap A + B1/B2, dan C ditangani sebagai **rekomendasi tertulis**, bukan kode.

Tiga alasan:

1. **Ini arsitektur lintas-repo, bukan bug.** Fix C1 berarti berhenti membaca
   `X-Tenant-Scheme` (`authentication_controller.rb:24-29`) dan menambah `tenant_id`
   ke `users` — yaitu migrasi baru di database yang **dibagikan dengan `rakamin-api`**
   (lihat C8). Menjalankan migrasi sepihak atas DB bersama, sebagai bagian case study
   intern, adalah jenis keberanian yang salah.
2. **Isolasi tenant setengah jadi lebih buruk daripada tidak ada.** Mengubah
   `default_scope` jadi fail-closed (C2) akan tiba-tiba mematikan seluruh jalur
   WebSocket & Sidekiq yang tenant-nya sering nil (catatan C2 di 02) — kecuali semua
   call-site sudah diperbaiki lebih dulu. Sekitaran sistem keamanan yang "terlihat
   diperbaiki padahal belum" adalah kegagalan yang lebih halus dan lebih mahal daripada
   bug yang jujur.
3. **Nilai yang bisa diberikan intern di titik ini adalah kualitas rekomendasinya.**
   Rekomendasi tertulis yang berurutan bisa langsung dieksekusi tim backend. Enam file
   setengah diubah tanpa satu spec pun tidak bisa.

**Rekomendasi berurutan** — ini rekomendasi, bukan hal yang sudah dieksekusi, dan
perbedaan statusnya sengaja dibuat kelihatan:

| Urut | Aksi | Temuan | Ketergantungan |
|---|---|---|---|
| 1 | Tenant hanya dari JWT **terverifikasi**; hapus pembacaan `X-Tenant-Scheme` dan `Referer` | C1 + C4 | Ubah alur autentikasi; butuh regresi penuh |
| 2 | `default_scope` fail-closed (403, bukan `all`) **setelah** semua call-site nil-tenant diaudit (WebSocket, Sidekiq) | C2 | Memutus flow kalau call-site belum siap — karena itu dia diurutan ke-2, bukan ke-1 |
| 3 | Migrasi `users.tenant_id` + backfill, **dikoordinasikan dengan `rakamin-api`** | C1 | DB bersama, lintas-repo |
| 4 | Audit 13 model sisanya ke `TenantScoped` | C3 | Beberapa memang global secara sah (mis. `SkillTaxonomy` — itu seed) |
| 5 | `config.filter_parameters` + hentikan transkrip masuk log | C7 | Paling murah di daftar ini — bisa berdiri sendiri |
| 6 | Perbaiki migrasi `down`: tanpa `CASCADE` | C8 | Edit 1 baris + dokumentasi |
| 7 | Cek role di channel WebSocket monitor | C5 | Bergantung urut 1–2 |

**C7 adalah satu-satunya item C yang saya dorong keras untuk segera dieksekusi** —
rasio risiko/manfaatnya paling tinggi: PII (transkrip wawancara) masuk log padahal
**tidak ada `filter_parameters` sama sekali** di seluruh konfigurasi, di produk
rekrutmen, di yurisdiksi yang punya UU Pelindungan Data Pribadi (UU PDP 27/2022).
Ukurannya kecil (`live_client.rb:288,292,297` + `http_client.rb:78` + satu baris
konfigurasi) — tidak perlu jadi proyek. Alasan saya tidak mengikutkannya di 9 perbaikan
bukan ukurannya, tapi lokasi: ia ada di `api/`, dan di `api/` belum ada satu pun jaring
pengaman yang bisa saya jalankan (lihat §1). Kode yang diubah tanpa bisa dibuktikan
bukan perbaikan, itu taruhan.

## 3. B3 & B4 — P1, tidak diperbaiki

- **B3** — form assessment: fetch gagal → `.catch(() => {})` diam, form tampil kosong,
  user klik Save → data valid tertimpa (`AssessmentEditPage.tsx:54` —
  `.catch(() => {})` di efek fetch :47-56).
- **B4** — hardware check selalu lulus: `setTimeout` 800 ms yang hasilnya dibuang,
  ditambah `vercel.json:11,14` mematikan camera dan ping 999 yang dikarang
  (`HardwareCheck.tsx:106-118`, `internetSpeedTest.ts:52`).

**Kenapa:** cakupan 9 perbaikan ditetapkan tema (integritas penilaian = A + B1/B2)
plus harness. B3 dan B4 punya jalur perbaikan yang jelas — B3 persis pola #7 (state
error + retry yang terlihat), B4 = check sungguhan + `Permissions-Policy` yang benar —
tapi menambahkannya berarti memperluas daftar tanpa memperdalam tema. Distingsinya juga
jujur: B1/B2 ada di **alur wawancara itu sendiri** — persis hal yang brief minta
dilindungi — sedangkan B3 halaman sekunder dan B4 onboarding.

## 4. D4, D6, E2, E3, S2

- **D4** (`web/tsconfig.json` tanpa `noUncheckedIndexedAccess`): mengaktifkannya
  akan menyebarkan error indexed-access ke seluruh codebase. Itu perubahan program
  penuh yang layak punya PR sendiri, satu commit per file — bukan footnote di tengah
  20 file perbaikan lain.
- **D6** (zod terpasang tapi tidak dipakai): mengadopsi zod adalah keputusan desain
  tim — batas mana yang divalidasi dengan schema apa. Mengganti semua form sepihak =
  scope creep.
- **E2** (hanya **3** kecocokan `aria-|role=|sr-only|tabIndex|onKeyDown` di seluruh
  `web/src`) dan **E3** (hanya **satu** class breakpoint): ini **program, bukan patch**.
  Menabur `aria-label` seadanya di produk yang dipakai menilai orang adalah kegagalan
  yang sama persis dengan klaster C — sistem yang terlihat diperbaiki padahal bukan.
  Yang dikerjakan dari klaster E adalah #8 (E1), satu-satunya item a11y yang bisa
  diperbaiki dengan benar di scope komponen (`useId` + `aria-label` di sumbernya,
  bukan di empat pemanggil).
- **S2** (README backend salah path): doc-fix lima menit di repo yang bukan
  deliverable utama.

## 5. Kalau ada 2 minggu lagi

Berurutan, berdasarkan ketergantungan:

1. **C7**: `filter_parameters` + hentikan transkrip di log — item C dengan rasio
   terbaik, bisa berdiri sendiri; dan sekarang jaring pengaman `spec/` sudah ada
   untuk menjaganya.
2. **B3 + B4**: state error form assessment; hardware check sungguhan.
3. **RuboCop dengan konfigurasi bertahap**: baseline config dari tim → hanya file baru
   yang diangket → menyusul file lama. Masih keputusan tim soal gaya, tapi sekarang
   bisa punya CI yang menjaganya.
4. **CI hijau di GitHub** (workflow dua job sudah dibuat — 04 §2c), screenshot, video
   3–5 menit, PDF.
5. **Klaster C sebagai proposal proyek** — urut 1–3 dari tabel §2 (JWT terverifikasi,
   fail-closed, `users.tenant_id`), dengan koordinasi lintas-repo ditulis eksplisit.
   Sebagai proyek yang di-scoped dengan benar, bukan PR setengah jadi.

**Sengaja tidak masuk daftar 2 minggu:** E2/E3 penuh (butuh audit a11y + uji perangkat
nyata — itu program), dan keputusan D4/D6 (itu rapat tim, bukan kode).

## 6. Checklist jujur — apa yang belum benar saat ini

Untuk dibaca ulang sebelum submit:

- [x] `rspec` — **43 examples, 0 failures** (Docker ruby 3.3.2 + Postgres 16 + Redis 7)
- [x] Seeded fault backend (A1) — MERAH `7 examples, 2 failures` → revert → HIJAU
  (commit `52be6c3` + revert `20a47b0` terlihat di history branch)
- [x] Migrasi #3 reversibel — `db:rollback STEP=1` → `db:migrate` dijalankan
- [x] Walkthrough aplikasi dengan backend hidup — API jalan (`/api/v1/health` 200),
  data portfolio/fit-gap dirender dari DB lokal
- [ ] `rubocop` / `brakeman` — **belum dijalankan** (keputusan tim, lihat ringkasan)
- [ ] CI di GitHub — workflow **dibuat** (`.github/workflows/ci.yml`, 2 job), **belum
  pernah jalan** (repo belum di-push)
- [ ] Screenshot, video, PDF — screenshot dibuat dari run nyata (folder `screenshots/`);
  video direkam sendiri; PDF dirakit sebelum upload

Semua yang **di luar** daftar ini — 47 test FE hijau, 43 RSpec examples, seeded fault
FE dan BE dengan output MERAH aslinya, typecheck, lint, build — benar-benar dijalankan.
Output aslinya ada di 04 §10 dan 05 §4/§6.

> **[PERLU SUARAMU:** dokumen ini adalah tempat jawaban "kenapa tidak dikerjakan
> X?" di defense disiapkan. Latih satu jawaban 30 detik untuk tiap butir:
> 1. Kenapa C jadi rekomendasi, bukan fix? (Jawaban = 3 alasan §2, versi bahasamu.)
> 2. Kenapa B4 tidak dikerjakan padahal jernih sekali cacatnya?
> 3. Kenapa tidak sekalian aktifkan `noUncheckedIndexedAccess`?
> 4. Hari pertama dari 2 minggu itu kamu mulai dari apa, dan kenapa dari sana?
> 5. Kalau penanya bilang *"C7 cuma 1 baris — kenapa tidak?"* — jawaban jujurnya:
>     bisa dikerjakan sekarang (harness sudah ada), diprioritaskan ke 2-minggu karena
>     menambah cakupan berarti memperlebar permukaan yang harus diuji di defense —
>     dan kalimat itu harus terasa jujur, bukan alasan.]
