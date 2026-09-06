# 06 — Yang Tidak Saya Kerjakan, dan Kenapa

**Aturan:** setiap baris di dokumen ini adalah sesuatu yang **tidak** dilakukan di case
study ini — beserta alasannya. Dokumen ini ada supaya dokumen lain tetap jujur:
04 dan 05 hanya berisi hal yang benar-benar dijalankan (dan diverifikasi); apa pun yang
hanya berupa rekomendasi atau rencana, tercatat di sini, dipisahkan dengan jelas.

Ringkasan:

| Item | Status | Kenapa |
|---|---|---|
| #1–#3 (A1, A2, A3) | **Rencana, tidak dieksekusi** | Ruby/rspec tidak terpasang; `spec/` tidak ada → perbaikan tidak bisa dibuktikan jalan |
| Klaster C (C1–C9) | **Rekomendasi tertulis, tanpa kode** | Arsitektur lintas-repo; menambal setengah jalan lebih berbahaya daripada tidak menambal |
| B3, B4 | Tidak diperbaiki | Scope 9 perbaikan ditetapkan tema (A + B1/B2) + harness |
| D4, D6 | Tidak disentuh | Perubahan program penuh / keputusan desain tim, bukan footnote |
| E2, E3 | Tidak diperbaiki | Program, bukan patch |
| S2 | Tidak diperbaiki | Doc-fix di repo yang bukan deliverable utama |
| `rspec` / `rubocop` / `brakeman` | **Belum dijalankan** | Ruby belum terpasang (05 §6) |
| CI di GitHub | Workflow **dibuat**, **belum pernah hijau** | Repo belum di-push |

---

## 1. #1–#3 — inti tema, tapi tidak dieksekusi

Ini bagian yang paling tidak nyaman untuk dijawab, jadi ditulis paling depan.

- **A1** — loop transisi memakai `probe_count` sama berulang
  (`api/app/services/coverage/state_engine.rb`, loop `resolve_state`): opsi B
  (maksimal satu state maju per panggilan) sudah dipilih di 03, tapi hanya **rencana**.
- **A2** — auto-advance `covered` menimpa `last_signal` dengan string robot
  (`coverage_analyzer_worker.rb:91-101`): opsi B (tidak menulis `covered`, tidak
  menyentuh `last_signal`, + `Rails.logger.warn` terstruktur) hanya **rencana**.
- **A3** — `level` hilang dari respons AI → L1 (`portfolios/generator.rb:161`): opsi B
  (`ai_level` kosong + status `unknown`) hanya **rencana** — dan ini butuh perubahan
  kontrak validasi (`schema.rb:115`, `ai_level` NOT NULL), yang merupakan keputusan tim,
  bukan keputusan intern.

**Kenapa tidak dieksekusi:** tidak ada Ruby yang jalan di environment kerja ini.
Buktinya ada di D1 — `api/.rspec` sudah ada (`--require spec_helper`) tapi folder
`spec/` tidak ada sama sekali, jadi `rspec` tidak bisa boot. Memperbaiki A1–A3
**tanpa** bisa menjalankan spec-nya berarti melakukan persis hal yang brief larang:
mengklaim sesuatu yang tidak dijalankan. Maka yang diserahkan adalah: temuan + bukti
`file:line` + 3 opsi + alasan pilihan (03 §#1–#3) — eksekusinya tertahan di blocker
lingkungan, bukan di pemahaman.

**Yang dibutuhkan untuk melanjutkannya:** Ruby 3.3.2 + bundler, bootstrap `spec/`
(`spec_helper` + factory_bot — semua sudah dideklarasikan di `Gemfile`), tiga spec
(satu per item), satu seeded fault (kembalikan loop asli `StateEngine` → merah).
Detail siklusnya sudah direncanakan di 05 §4b.

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

1. **Ruby + spec** (D1): Ruby 3.3.2 + bundler, bootstrap `spec/`, jalankan `rspec`
   sampai bisa boot dengan dependensi yang sudah ada di `Gemfile`. Ini yang
   membuka pintu #1–#3.
2. **#1–#3 dengan RSpec**: tiga spec + satu seeded fault BE (siklus HIJAU→MERAH→
   HIJAU sudah direncanakan di 05 §4b), eksekusi rencana 03.
3. **C7**: `filter_parameters` + hentikan transkrip di log — item C dengan rasio
   terbaik, bisa berdiri sendiri.
4. **B3 + B4**: state error form assessment; hardware check sungguhan.
5. **CI hijau di GitHub** (workflow sudah dibuat — 04 §2; repo belum di-push),
   screenshot, video 3–5 menit, PDF.
6. **Klaster C sebagai proposal proyek** — urut 1–3 dari tabel §2 (JWT terverifikasi,
   fail-closed, `users.tenant_id`), dengan koordinasi lintas-repo ditulis eksplisit.
   Sebagai proyek yang di-scoped dengan benar, bukan PR setengah jadi.

**Sengaja tidak masuk daftar 2 minggu:** E2/E3 penuh (butuh audit a11y + uji perangkat
nyata — itu program), dan keputusan D4/D6 (itu rapat tim, bukan kode).

## 6. Checklist jujur — apa yang belum benar saat ini

Untuk dibaca ulang sebelum submit:

- [ ] `rspec` — **belum dijalankan** (Ruby belum terpasang)
- [ ] `rubocop` / `brakeman` — **belum dijalankan**
- [ ] CI di GitHub — workflow **dibuat** (`.github/workflows/ci.yml`), **belum pernah
  hijau** (repo belum di-push)
- [ ] Walkthrough aplikasi dengan backend hidup — **belum dijalankan** (API tidak
  dinyalakan; sisi web diverifikasi lewat test, typecheck, lint, build)
- [ ] Seeded fault backend (A1) — **rencana** (05 §4b), **belum dijalankan**
- [ ] Screenshot, video, PDF — akan dibuat (panduan di `screenshots/`)

Semua yang **di luar** daftar ini — 46 test FE hijau, seeded fault FE 1 baris dengan
output MERAH aslinya, typecheck, lint, build — benar-benar dijalankan. Output aslinya
ada di 04 §10 dan 05 §6.

> **[PERLU SUARAMU:** dokumen ini adalah tempat jawaban "kenapa tidak dikerjakan
> X?" di defense disiapkan. Latih satu jawaban 30 detik untuk tiap butir:
> 1. Kenapa C jadi rekomendasi, bukan fix? (Jawaban = 3 alasan §2, versi bahasamu.)
> 2. Kenapa B4 tidak dikerjakan padahal jernih sekali cacatnya?
> 3. Kenapa tidak sekalian aktifkan `noUncheckedIndexedAccess`?
> 4. Hari pertama dari 2 minggu itu kamu mulai dari apa, dan kenapa dari sana?
> 5. Kalau penanya bilang *"C7 cuma 1 baris — kenapa tidak?"* — jawaban jurnya ada
>    di §2: bisa, tapi tidak dieksekusi karena ia hidup di `api/` yang belum punya
>    satu pun jaring pengaman yang bisa dijalankan. Alasan yang sama dengan #1–#3,
>    dan itu konsisten.]
