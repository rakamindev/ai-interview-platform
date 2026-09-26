---
title: Comprehensive Engineering & Product Revamp Report
subtitle: Next-Generation AI Interview & Skill Assessment Platform — Backend-leaning Submission
kandidat: Vika Putri Ariyanti
tanggal: 26 September 2026
repo: https://github.com/rakamindev/ai-interview-platform
fork: https://github.com/Vputri/ai-interview-platform
pr: https://github.com/rakamindev/ai-interview-platform/pull/141
pr_label: Pull Request #141 — satu PR (Option A), branch feat/be-hardening
video: https://www.loom.com/share/7793f2168932440384525a5d923dff7c
depth: Backend-heavy dengan seam frontend
---
## 1. Pull Request & Ringkasan Eksekutif

Produk ini menggantikan penilaian interviewer teknis manusia dengan AI dalam skala besar. Artinya, kesalahan di pipeline bukan sekadar bug tampilan: skor yang salah adalah **keputusan hiring** yang salah, dan kandidat yang dinilai tidak pernah memilih sistem ini.

Audit saya menemukan satu pola: **sistem gagal secara diam-diam**. Kegagalan model AI disimpan sebagai portfolio `complete` yang kosong, job fit/gap yang habis retry membuat UI menunggu selamanya, admin yang sudah dinonaktifkan masih bisa login, dan WebSocket melewati pemeriksaan role yang berlaku di HTTP. Tidak ada CI dan tidak ada test yang menangkapnya.

Perubahan ini membuat kegagalan **eksplisit dan bisa dipulihkan**, menutup celah autentikasi dan tenant, dan memasang harness test yang berjalan di CI.

| Ukuran | Sebelum | Sesudah |
|---|---|---|
| RSpec (api) | 0 di `main`, 69 di `dev` (1 gagal karena butuh Redis hidup) | **168 contoh, 0 gagal**, tanpa Redis dan tanpa `application.yml` |
| Vitest (web) | tidak ada runner di `main` | **36 tes, 0 gagal** |
| CI | tidak ada | RSpec, `tsc`, vitest, brakeman (0 warning), bundler-audit |
| Migration baru | — | 3, semuanya reversible dan aman untuk row lama |
| Seeded fault | — | **17 branch** di fork, tiap fix dirusak lalu di-revert (history terlihat) |
| Skala perubahan baru | — | 29 commit, 70 file, +1.814 / −104 baris |

> **Klaim kedalaman: backend-heavy.** Sekitar 75% baris kode baru (di luar dokumentasi) ada di `api/`: kode aplikasi, migration, dan spec (1.262 dari 1.678 baris). Sisi web dikerjakan sebagai *seam*: state gagal dan retry di halaman yang membaca hasil pipeline tersebut.

### Pull Request (Option A — satu PR)

Satu PR komprehensif (**Option A**): [Pull Request #141](https://github.com/rakamindev/ai-interview-platform/pull/141), dari `feat/be-hardening` ke `main`.

Branch ini dipotong dari `dev`, yaitu pekerjaan frontend-heavy dari percobaan saya sebelumnya. Karena itu diff terhadap `main` juga memuat pekerjaan tersebut (164 file). **Pekerjaan baru untuk submission ini adalah 29 commit di `dev..feat/be-hardening`**, dengan pembagian berikut.

| Area | Perubahan | File |
|---|---|---|
| `api/app` | generator, worker, auth, WebSocket, lock, middleware | 16 file, +183/−41 |
| `api/spec` | spec baru | 19 file, +931 |
| `api/db` | 3 migration, schema, seeds | 5 file |
| `web/src` | state gagal, retry, form, interceptor, test | 15 file, +338/−17 |
| `.github` | CI | 1 file |
| `assessment` | dokumentasi | 3 file |

## 2. Product Context & UU PDP 2022 Legal Compliance

**Produk.** Assessor mendefinisikan role dan skill (L1–L5). Kandidat menjalani interview suara realtime bersama Gemini Live. Sebuah *coverage map* melacak skill yang sudah diprobe. Setelah sesi selesai, transcript dan coverage map diubah menjadi portfolio (rating, confidence, kutipan bukti) dan matriks fit/gap.

**Industri (hiring Indonesia).** Volume tinggi (rekrutmen kampus, BPO, sales) adalah titik sakit terbesar. Parsing CV, penjadwalan, dan tes psikometri sudah komoditas. Leverage sebenarnya adalah **sinyal teknis yang terstruktur dan bisa diaudit** di ujung atas funnel. Diferensiatornya adalah coverage map ditambah kutipan bukti, sehingga assessor bisa mengaudit *kenapa* kandidat mendapat L3, bukan hanya melihat angkanya.

**Apa yang harus tetap benar.**
1. Skor harus cukup dipercaya sampai manusia bertindak tanpa mengulang kerja.
2. AI harus **gagal dengan jelas, bukan diam-diam**. Rating kosong akibat timeout tidak boleh terlihat sama dengan kandidat yang memang berskor rendah.
3. Setup assessment harus tetap cepat.

**Pengguna.** Assessor, recruiter, dan hiring manager bukan evaluator teknis AI, jadi mereka tidak akan menyadari bug scoring yang halus. Itu menjadikan kebenaran pipeline sebagai concern P0 secara default.

**Kandidat yang tidak pernah memilih.** WebSocket putus, model gagal, atau portfolio gagal dibuat bisa menutup peluang kerja seseorang tanpa tanda apa pun. Bahaya konkret yang saya rancang untuk dihindari:
- error teknis dibaca sebagai kandidat diam;
- skill yang tidak pernah ditanyakan tampil sebagai skor rendah, bukan "belum dinilai";
- job ganda menghasilkan rating berbeda dari transcript yang sama tanpa catatan.

**UU PDP.** Audio, transcript, dan skor adalah data pribadi individu bernama, dan dapat mendekati data sensitif. Implikasinya: isolasi tenant adalah kewajiban kepatuhan (bukan sekadar bug), transcript dan PII tidak boleh masuk log, dan pesan error model tidak boleh tersimpan atau tampil ke pengguna. Kebijakan retensi dan hapus data belum ada di produk; ini saya catat sebagai *missing specification* dan tidak saya kerjakan tanpa keputusan hukum dan produk.

## 3. Severity-Ranked Problem & Gap Analysis (P0–P3 Matrix)

Pekerjaan `dev` sebelumnya sudah menutup gap P0/P1 awal (IDOR lintas tenant, state "belum dinilai", state error kandidat, hardware check, invite link, dan lainnya). Audit ulang atas `dev` menemukan gap **baru**, lalu dua putaran audit keamanan menemukan sisanya. Semuanya diverifikasi langsung di kode, bukan diasumsikan.

### 3.1 Temuan yang ditutup di PR ini

| Sev | Layanan | Jenis | Temuan | Dampak pada workflow |
|---|---|---|---|---|
| **P0** | api | defective | Gemini gagal, generator menyimpan portfolio **semua `not_assessed` berstatus `complete`** | Assessor melihat "kandidat tidak diuji sama sekali" padahal modelnya yang error |
| **P0** | api | defective | `login` fallback ke `organizations LIMIT 1` atau `test-corp` | Admin global bisa mendapat token tenant sembarang |
| **P0** | api | defective | WebSocket menerima JWT role apa pun dan akun nonaktif | Bypass role dan revocation lewat jalur non-HTTP |
| **P0** | api | missing spec | Admin di tabel `users` global tanpa tenant | Satu admin dapat menjangkau semua tenant |
| **P0** | api | defective | Dependency dengan advisory High (puma, rack, websocket-driver, jwt, nokogiri, faraday, addressable) | DoS dan kerentanan yang diketahui di jalur produksi |
| **P1** | api | missing spec | Job ganda di portfolio yang sama, tanpa transaksi | Skor bisa hilang atau setengah jadi |
| **P1** | api+web | missing spec | Job fit/gap habis retry tanpa terminal state | UI polling "Generating…" tanpa akhir |
| **P1** | api | defective | Admin nonaktif tetap mendapat token saat login | Akses tidak dicabut sampai token kedaluwarsa |
| **P1** | api | defective | Audio WS mengabaikan expiry invite; `audio_complete` bisa menutup sesi yang belum mulai | Bypass aturan invite; interview bisa "terbakar" lewat link bocor |
| **P1** | api | defective | Audio WS tanpa guard koneksi ganda | Dua tab membuka dua sesi Gemini: biaya ganda, transcript tercampur |
| **P1** | api | defective | `Organization.identify` mencocokkan 4 kolom dengan `.first` tanpa urutan | Tenant bisa berubah antar-panggilan |
| **P1** | web | defective | Salah password memicu reload halaman login | Pesan error tidak pernah terlihat |
| **P1** | web | defective | Edit Vacancy/Assessment yang gagal load menampilkan form kosong yang bisa disimpan | Data asli bisa tertimpa |
| **P2** | api | defective | Pesan error model (`e.message`) disimpan dan tampil | Bisa membocorkan detail request |
| **P2** | api | missing spec | Tanpa `filter_parameter_logging`; token tanpa `exp` diterima; WS tanpa batas ukuran; `assessor_notes` tanpa batas; rate limit hanya per-IP | Kebocoran log, token abadi, memory DoS, spam |
| **P2** | api+web | missing spec | `SystemPromptGeneratorWorker` mati diam-diam; axios tanpa timeout; container berjalan sebagai root | Kegagalan tak terlihat, spinner tanpa akhir |
| **P2** | api+web | missing spec | Tidak ada CI; spec `fitgap` bergantung Redis hidup | Regresi lolos tanpa terdeteksi |

### 3.2 Missing specification vs defective implementation

**Belum pernah didefinisikan (missing spec):** terminal state untuk job non-portfolio, masa berlaku dan koneksi tunggal untuk sesi, tenant milik admin lokal, batas ukuran pesan dan catatan, harness test dan CI, serta kebijakan retensi data kandidat.

**Sudah didefinisikan tetapi rusak (defective):** pola `TenantScoped` sudah ada tetapi login mengabaikannya; `AuthorizeApiRequest` ada di HTTP tetapi tidak dipakai WebSocket; generator sudah punya *fallback* yang niatnya defensif tetapi menyembunyikan kegagalan; mekanisme revocation akun hanya berlaku di request berikutnya, bukan saat login.

### 3.3 Constraint Signal (yang saya eskalasi ke Technical Lead pada proyek nyata)

1. **Rails 7.0 sudah EOL** (sejak April 2025). Dua belas advisory pada activestorage, activesupport, activerecord, dan actionview hanya hilang dengan upgrade ke 7.2 atau lebih baru. Ini keputusan roadmap, bukan patch. Untuk sementara dicatat eksplisit di `api/.bundler-audit.yml` beserta alasannya; advisory baru tetap menggagalkan CI.
2. **Revocation role `assessor`** (token dari rakamin-api) tidak bisa dicabut dari aplikasi ini karena tidak ada data lokal untuk diperiksa. Perlu webhook atau cache bersama dari aplikasi saudara.
3. **Invite token kandidat lewat query string WebSocket** masuk access log proxy. Solusi yang benar (pesan `auth` pertama) mengubah protokol FE dan BE, jadi dijadwalkan terpisah.
4. **`audio_websocket_middleware.rb` (800+ baris)** punya test autentikasi, batas ukuran, dan lock, tetapi belum test perilaku end-to-end (timer, reconnect, transisi coverage). Ini risiko struktural terbesar yang tersisa.
5. **JWT disimpan di `localStorage`.** Risiko kecil saat ini (tidak ada `innerHTML`), tetapi cookie `HttpOnly` plus CSRF lebih kuat dan mengubah auth di kedua sisi.
6. **Retensi dan hapus data kandidat** (UU PDP) butuh keputusan hukum dan produk.

## 4. Strategic Option Evaluation, Acceptance Criteria & Trade-off Matrix

### 4.1 Opsi solusi

**Pilihan bentuk PR: Option A (satu PR) dipilih.** Brief memberi dua opsi. Option B (umbrella plus sub-PR) sudah saya pakai pada percobaan sebelumnya dan menghasilkan 10 PR yang sulit diikuti. Kali ini perubahan-perubahannya saling terkait (status portfolio, retry worker, dan UI-nya), sehingga satu PR dengan commit kecil bertema lebih mudah diaudit dan bisa diuji sebagai satu kesatuan.

**Pilihan mekanisme kegagalan dan job ganda** (inti perubahan):

| | **A. Guard di service + status di DB (dipilih)** | B. Gem unique-jobs Sidekiq | C. State machine (AASM) |
|---|---|---|---|
| Dampak produk | Menutup kegagalan diam-diam, job ganda, dan UI menggantung sekaligus | Hanya menutup job ganda | Menutup semuanya, rapi |
| Biaya | 2 kolom nullable, sekitar 60 baris | Dependency baru dan lock Redis terpisah | Dependency baru dan refactor semua status |
| Long-term maintainability | State sudah ada di DB; mudah dibaca dan dites | Lock Redis tidak terlihat dari DB | Terbaik jangka panjang |
| Failure mode | Lock baris DB; worker mati diambil alih setelah 10 menit | Lock Redis bisa menggantung; tidak tahu status DB | Migrasi status berisiko untuk data lama |
| Bisa dibatalkan? | Murah (rollback dua migration) | Murah | Mahal |
| Contextual fit | **Terbaik untuk codebase dan tenggat ini** | Parsial | Berlebihan untuk skala ini |

**Pilihan pengikatan admin ke tenant:** `users.organization_id` (dipilih) vs login per-tenant lewat subdomain. Opsi pertama tidak mengubah alur login yang ada dan bisa dimigrasikan aman (nullable, backfill hanya bila tepat satu organisasi, selain itu *fail closed*).

**Pilihan guard koneksi ganda:** Redis `SET NX EX` dengan TTL dan perpanjangan (dipilih) vs lock in-process. Lock in-process tidak berlaku lintas worker Puma atau pod. Konsekuensinya lock harus fail-open bila Redis mati, agar gangguan infrastruktur tidak mengunci kandidat dari interview-nya.

### 4.2 Acceptance criteria (ditulis sebelum kode)

- Model gagal atau respons rusak **tidak pernah** menghasilkan `complete` berisi data kosong. Job di-retry, dan setelah retry habis statusnya `failed` serta bisa diulang manual.
- Penyimpanan skill adalah satu transaksi. Kegagalan di tengah tidak menghapus skor lama.
- Job ganda: portfolio `complete` atau `generating` yang baru (kurang dari 10 menit) dilewati. `generating` yang basi (worker mati) diambil alih.
- Dari sebuah error hanya nama class yang disimpan atau ditampilkan, tidak pernah `message`.
- Fit/gap gagal menghasilkan state `failed` di API dan UI, tombol coba lagi, dan polling berhenti.
- Admin nonaktif atau bukan milik tenant tidak mendapat token, di HTTP maupun WebSocket.
- Halaman yang gagal load tidak pernah menampilkan form kosong yang bisa disimpan.
- Migration reversible, aman untuk row lama, dan tidak ada data pribadi di log atau commit.

### 4.3 Edge case yang ditangani

| Kasus | Perilaku |
|---|---|
| Skill tidak pernah diprobe | `not_assessed` (dari `dev`), tidak pernah skor rendah palsu |
| Respons model rusak atau timeout | Job di-retry, lalu `failed`, tidak ada portfolio kosong |
| Dua job berjalan bersamaan | Lock baris; yang kedua dilewati |
| Worker mati saat `generating` | Diambil alih setelah 10 menit |
| Redis mati | Lock koneksi fail-open; kandidat tetap bisa interview |
| Refresh halaman saat interview | Error `already_connected` bersifat *recoverable*; klien retry dan masuk begitu lock lepas |
| Tab kedua yang ditolak menutup | Tidak melepas lock milik tab pertama |
| Lock kedaluwarsa lalu diambil koneksi lain | Pemilik lama tidak bisa menghapus lock baru (dicek token) |
| Catatan assessor 2.000+ karakter | Ditolak API (422); form membatasi input dan menampilkan penghitung |
| Catatan lama yang sudah melebihi batas | Tombol simpan dinonaktifkan dengan pesan jelas |
| Email login dengan huruf besar, body JSON atau form | Throttle per-akun menghitung sama |
| Admin lama tanpa `organization_id` | Ditolak saat login (fail closed), bukan diberi akses ke semua tenant |
| Backend down saat halaman dibuka | Pesan error dan tombol coba lagi, tanpa layar kosong |

## 5. Automated Test Suite & Seeded Fault Verification

### 5.0 Baseline & Setup

- Repo dijalankan lokal (Rails + PostgreSQL + Redis, React + Vite). Branch kerja dipotong dari `dev`, tidak ada commit langsung ke `main`, commit dibuat kecil dan bermakna (satu fix per commit).
- **Baseline yang saya temukan:** suite RSpec di `dev` memuat 69 contoh dengan satu yang gagal. Penyebabnya, spec `fitgap` memanggil `perform_async` ke Redis sungguhan, sehingga suite tidak hermetic dan pasti gagal di CI. Diperbaiki lebih dulu dengan `Sidekiq::Testing.fake!` (commit pertama) supaya semua bukti sesudahnya bisa dipercaya.
- Database test memakai container PostgreSQL terpisah. Suite juga saya jalankan dengan `env -i` tanpa `application.yml` untuk memastikan CI tidak bergantung pada file lokal.

### 5.1 Cakupan test

| Set | Isi | Hasil |
|---|---|---|
| RSpec | model, service, worker, request, channel, config, lib | **168 contoh, 0 gagal** |
| Vitest | halaman fit/gap, edit vacancy, portfolio, override panel, api client | **36 tes, 0 gagal** |
| `tsc --noEmit` | seluruh web | bersih |
| brakeman | seluruh api (kecuali cek EOLRails yang sudah dieskalasi) | 0 warning |
| bundler-audit | seluruh api | bersih (12 advisory Rails 7.0 dikecualikan eksplisit dengan alasan) |

Harness dijalankan dalam kondisi CI (`env -i`, tanpa `application.yml`, tanpa Redis) supaya bukti tidak bergantung pada mesin saya. Setiap fix ditulis **test dulu** dan dilihat gagal sebelum kode diubah. Beberapa test gagal karena bug produk yang nyata (misalnya login admin nonaktif mengembalikan 200).

### 5.2 Seeded fault test (17 branch di fork)

Tiap fix dirusak di branch scratch, test dijalankan sampai merah, lalu di-revert. History dua commit (fault lalu revert) tetap terlihat di `Vputri:scratch/seeded-fault-*`.

| Branch (`scratch/seeded-fault-…`) | Kerusakan yang disuntikkan | Test gagal |
|---|---|---|
| `generator-swallows-error` | hapus `raise` di generator | 2 |
| `generator-duplicate-job` | hapus guard `complete?` | 1 |
| `fitgap-failed-served-as-cached` | report `failed` dianggap cache | 1 |
| `fitgap-ui-ignores-failed` | UI mengabaikan status `failed` | 2 |
| `inactive-admin-login` | hapus cek `active?` di login | 1 |
| `login-tenant-fallback` | login memakai organisasi pertama | 1 |
| `login-ignores-admin-tenant` | login tidak cek `organization_id` | 3 |
| `token-ignores-admin-tenant` | otorisasi tidak cek `organization_id` | 4 |
| `ws-skips-role-check` | WebSocket tanpa cek role | 2 |
| `audio-complete-pending` | `audio_complete` menerima sesi belum mulai | 1 |
| `jwt-no-exp-required` | token tanpa `exp` diterima | 1 |
| `log-filter-password` | hapus filter `:password` | 1 |
| `login-email-throttle-off` | throttle per-akun mati | 2 |
| `org-identify-unordered` | urutan tenant tidak deterministik | 1 |
| `ws-lock-not-released` | lock tidak dilepas saat tutup | 1 |
| `ws-lock-not-checked` | koneksi kedua tidak diperiksa | 2 |
| `lock-releases-others` | lock milik koneksi lain ikut dihapus | 1 |

Satu seeded fault sempat **lolos** pertama kali (`org-identify-unordered`): test saya lemah karena urutan `id` kebetulan sama dengan hasil yang diharapkan. Saya menambah kasus arah sebaliknya, lalu memverifikasi bahwa test gagal untuk urutan `id ASC` maupun `id DESC`.

### 5.3 AI Verification Moment

AI dipakai sebagai leverage yang diverifikasi, bukan sebagai oracle. Lima kejadian di mana output AI salah atau berisiko, beserta cara saya memverifikasi:

1. **Filter log terlalu lebar.** Draf awal memakai `:text` polos. Rails mencocokkan *sebagian* nama key, sehingga `context` dan `textarea` ikut tersamar. Diperbaiki menjadi `/\Atext\z/` dan ditambah test bahwa key tersebut tidak ikut disamarkan.
2. **Tebakan env CI salah.** Draf memakai `JWT_SECRET_KEY`. Saya menjalankan suite dengan `env -i` tanpa `application.yml`. Hasilnya `KeyError: ALLOWED_ORIGINS`, dan workflow diperbaiki berdasarkan hasil itu, bukan tebakan.
3. **Bump dependency `json` ke 3.x.** `bundle update` menaikkan `json` ke 3.0.2 dan memecahkan factory (`ArgumentError`). Saya melihat suite merah, mem-pin `json` ke 2.x yang sudah ter-patch, dan menjalankan ulang seluruh suite serta boot Puma 7.
4. **Perintah `brakeman` yang tidak ada.** Opsi `--skip-checks` yang saya tulis ternyata tidak valid (`invalid option`); opsi yang benar `-x EOLRails`. Ketahuan karena saya menjalankan perintah CI secara lokal sebelum commit.
5. **Aksi git yang berisiko.** `git add api` dan `git add web/src` menyapu folder state tool agent (sekitar 5 MB) ke dalam commit. Ketahuan saat audit terakhir, dan sempat ter-push ke fork saya. Saya menghapusnya dari **seluruh** history (dengan backup lebih dulu), force-push ke branch itu, memverifikasi tidak ada sisa di remote, dan baru setelah itu membuat PR. Sejak itu saya selalu `git add` per file. Isinya hanya log dan memori tool (tidak ada kredensial), tetapi seharusnya tidak pernah masuk repo.

### 5.4 Data safety & migration

| Migration | Keamanan |
|---|---|
| `add_generation_started_at_to_portfolios` | kolom nullable |
| `add_status_to_fit_gap_reports` | default `complete` sehingga report lama tetap valid |
| `add_organization_id_to_users` | nullable; backfill hanya bila tepat satu organisasi, selain itu tetap `NULL` dan login *fail closed* |

Ketiganya dites `rollback` lalu migrate ulang. Migration terakhir juga dites untuk kedua kasus backfill (1 organisasi: terisi; 2 organisasi: tetap kosong).

## 6. Claimed Engineering Depth: Backend-heavy

**Backend-heavy.** Yang saya klaim, dan siap saya pertahankan dalam sesi teknis:

- **Reliabilitas pipeline AI:** semantik retry, idempotensi job, terminal state, transaksi, dan lock baris dengan pengambilalihan setelah worker mati.
- **Keamanan dan multi-tenancy:** pengikatan admin ke tenant, kesetaraan aturan HTTP dan WebSocket, revocation, pembatasan laju per-IP dan per-akun, batas ukuran pesan, dan rantai dependency.
- **Koordinasi terdistribusi:** lock koneksi berbasis Redis dengan TTL, perpanjangan, kepemilikan lewat token, dan *fail-open*.
- **Rekayasa proses:** test-first, seeded fault, CI, dan simulasi lingkungan CI.

Sisi frontend adalah seam yang sengaja tipis: state gagal dan retry, form yang membatasi input sesuai API, dan interceptor yang tidak menghapus pesan error. Semuanya punya test regresi.

## 7. Perubahan Antarmuka, Video & Batasan

### 7.1 Perubahan Antarmuka

Perubahan UI pada submission ini sengaja kecil dan berfokus pada **state kegagalan** yang sebelumnya tidak ada. Tiap state punya test regresi (vitest) dan bisa dicoba langsung dari branch `feat/be-hardening`.

| Layar | Sebelumnya | Sekarang |
|---|---|---|
| Login | Salah password memicu reload halaman, pesan error hilang | Pesan error tetap tampil, tanpa reload |
| Fit/Gap report | "Generating…" selamanya bila job gagal | State gagal dengan tombol "Try again"; polling berhenti |
| Edit Vacancy / Assessment | Gagal load menampilkan form kosong yang bisa disimpan | Pesan gagal load dengan tombol coba lagi; form tidak tampil |
| Portfolio | Halaman kosong bila gagal load | Pesan gagal load dengan tombol coba lagi |
| Override rating | Catatan tanpa batas; API menolak dengan pesan generik | Batas 2.000 karakter, penghitung, dan tombol simpan nonaktif untuk catatan terlalu panjang |

### 7.2 Video Demonstrasi

Video walkthrough 3–5 menit: [https://www.loom.com/share/7793f2168932440384525a5d923dff7c](https://www.loom.com/share/7793f2168932440384525a5d923dff7c)

### 7.3 Batasan & Rencana Lanjutan

Yang sengaja tidak dikerjakan dan alasannya (rincian di `assessment/be-hardening.md`):

| Item | Alasan | Langkah berikutnya |
|---|---|---|
| Upgrade Rails 7.0 → 7.2+ | Perubahan framework, bukan patch | Roadmap tersendiri dengan test end-to-end |
| Revocation role `assessor` | Butuh webhook dari rakamin-api | Keputusan lintas-tim |
| Invite token di query WS | Mengubah protokol FE dan BE | Pesan `auth` pertama, dengan test WS end-to-end |
| Test perilaku middleware audio WS | Butuh harness WS dan Gemini palsu | Prioritas berikutnya |
| Retensi dan hapus data kandidat | Butuh keputusan hukum dan produk | Diputuskan bersama Legal |
| Cookie `HttpOnly` untuk JWT | Mengubah auth kedua sisi | Bersamaan dengan item invite token |

## 8. Kesimpulan & Status Kesiapan

Submission ini berupa **satu Pull Request** ([#141](https://github.com/rakamindev/ai-interview-platform/pull/141)) yang membuat pipeline AI gagal secara **eksplisit dan bisa dipulihkan**, menutup celah autentikasi dan tenant di HTTP maupun WebSocket, dan memasang harness test yang berjalan di CI.

- **Terverifikasi:** 168 contoh RSpec dan 36 tes vitest lolos, `tsc` bersih, brakeman 0 warning, dan bundler-audit bersih. Setiap fix ditulis test-first dan dibuktikan lewat 17 seeded fault.
- **Aman untuk data:** tiga migration reversible; backfill hanya bila tidak ambigu, selain itu *fail closed*.
- **Jujur soal batas:** upgrade Rails 7.0, revocation role `assessor`, invite token di WebSocket, test perilaku middleware audio, dan kebijakan retensi data kandidat dieskalasi dan dicatat di bagian 7.3, bukan disembunyikan.

Saya siap menjelaskan dan mempertahankan setiap keputusan, termasuk opsi yang ditolak, pada sesi technical defense.

### 8.1 Cara Memverifikasi

```
cd api && bundle exec rspec          # 168 contoh
cd web && npm test && npx tsc --noEmit
```

CI (`.github/workflows/ci.yml`) menjalankan RSpec, `tsc`, vitest, brakeman, dan bundler-audit pada setiap PR. Bukti seeded fault ada di branch `scratch/seeded-fault-*` pada fork `Vputri/ai-interview-platform`.
