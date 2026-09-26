# Backend Hardening — PR ini (gabungan dev + `feat/be-hardening`)

Brief menuntut satu slice fullstack, tapi kedalaman boleh condong ke satu sisi.
PR ini **condong ke backend**: `dev` sudah berat di FE (~13k baris web vs ~1.5k
api), jadi gap yang tersisa ada di sisi api. Detail P0–P3 awal ada di
[gap-analysis.md](gap-analysis.md); dokumen ini cuma mencatat gap **baru** yang
ketemu di `dev` dan yang ditutup di branch ini.

## Gap baru (diverifikasi di kode `dev`)

| # | Sev | Service | Jenis | Dampak |
|---|-----|---------|-------|--------|
| B1 | P0 | api | defective | Gemini gagal → generator nyimpen portfolio **semua `not_assessed` dan status `complete`**. Assessor ngeliat "kandidat gak diuji sama sekali", padahal modelnya yang error. |
| B2 | P1 | api | missing spec | Job ganda (end handler + regenerate) bisa jalan paralel di portfolio yang sama; `destroy_all` + create tanpa transaksi → skor bisa hilang/setengah jadi. |
| B3 | P1 | api+web | missing spec | `FitGapGeneratorWorker` gak punya terminal state; gagal setelah retry → API 404 selamanya, UI polling "Generating…" tanpa akhir. |
| B4 | P1 | api | defective | `POST /auth/login` ngasih token ke admin yang `active: false` (baru ditolak di request berikutnya). |
| B5 | P2 | api | defective | `e.message` dari Gemini disimpan ke `generation_error` dan diekspos ke UI (bisa ngandung detail request). |
| B6 | P2 | api | missing spec | Gak ada `filter_parameter_logging`: password/JWT/nama kandidat bisa masuk log (UU PDP). |
| B7 | P2 | api | missing spec | `SystemPromptGeneratorWorker` mati diam-diam setelah retry. |
| B8 | P2 | ci | missing spec | Spec `fitgap` butuh Redis hidup (500 tanpa Redis) dan gak ada CI. |

## Acceptance criteria (ditulis sebelum kode)

- Model gagal / respons rusak → **tidak pernah** `complete` dengan data kosong; job di-retry; setelah habis retry status `failed` dan bisa di-retry manual.
- Simpan skill = satu transaksi; kegagalan di tengah tidak menghapus skor lama.
- Job ganda: portfolio `complete` atau `generating` yang baru (<10 menit) di-skip; `generating` basi (worker mati) diambil alih.
- Yang disimpan/ditampilkan dari error cuma nama class, tidak pernah `message`.
- Fit/gap gagal → state `failed` terlihat di API dan UI, ada tombol "Try again", polling berhenti.
- Admin nonaktif tidak dapat token.
- Migration reversible dan aman untuk row lama (default `complete`, kolom nullable).

## Opsi & trade-off

| | A. Guard di service + status di DB (dipilih) | B. Sidekiq unique jobs / gem | C. Pindah ke state machine (AASM) |
|---|---|---|---|
| Dampak | Nutup B1–B3 langsung | Nutup B2 saja | Nutup B1–B3, rapi |
| Biaya | 2 kolom kecil, ~60 baris | Dependency baru + Redis-lock | Dependency + refactor semua status |
| Failure mode | Lock baris DB; stale-takeover 10 menit | Lock Redis bisa nyangkut, tidak lihat status DB | Migrasi status berisiko ke data lama |
| Balik ke belakang | Murah (rollback 2 migration) | Murah | Mahal |

A dipilih: state sudah ada di DB, `with_lock` cukup, dan gak nambah dependency.

## Bukti (Monozukuri)

- RSpec: 69 → 168 contoh (0 gagal), jalan **tanpa `application.yml` dan tanpa Redis** (disimulasikan, lihat CI env).
- CI baru: `.github/workflows/ci.yml` (rspec + `tsc` + vitest).
- Seeded fault — tiap fix dirusak di scratch branch, test gagal, lalu di-revert (history terlihat):

| Branch | Rusak apa | Test yang menangkap |
|---|---|---|
| `scratch/seeded-fault-generator-swallows-error` | hapus `raise` | 2 gagal (generator_spec) |
| `scratch/seeded-fault-generator-duplicate-job` | hapus guard `complete?` | 1 gagal |
| `scratch/seeded-fault-inactive-admin-login` | hapus `&& user.active?` | 1 gagal |
| `scratch/seeded-fault-fitgap-failed-served-as-cached` | failed dianggap cache | 1 gagal |
| `scratch/seeded-fault-log-filter-password` | hapus `:password` | 1 gagal |
| `scratch/seeded-fault-fitgap-ui-ignores-failed` | UI abaikan `failed` | 2 gagal (vitest) |

## AI verification moment

1. AI awalnya nulis filter log `:text` polos. Rails mencocokkan **sebagian** nama key, jadi `context`, `textarea`, dst ikut ter-redact. Diperbaiki jadi `/\Atext\z/`, dan spec dicek memakai key beda.
2. AI menebak env CI (`JWT_SECRET_KEY`). Saya jalankan rspec dengan `env -i` tanpa `application.yml`: gagal `KeyError: ALLOWED_ORIGINS`. Workflow diperbaiki berdasarkan hasil itu, bukan tebakan.
3. Spec sessions AI awalnya `POST /sessions/:id/end`; route sebenarnya `end_session`. Ketahuan dari `RoutingError`, bukan dari asumsi.

## Constraint signal tambahan (eskalasi ke Tech Lead)

- `POST /auth/login` fallback ke `SELECT scheme FROM organizations LIMIT 1` kalau header `X-Tenant-Scheme` kosong → admin bisa dapat token tenant sembarang. Perlu keputusan produk (wajib header? resolve dari host?), belum diubah.
- `assessments#create` mengembalikan `system_prompt_generated: true` padahal baru di-enqueue.
- Kebijakan retensi/hapus data kandidat (UU PDP) masih belum ada; butuh keputusan hukum + produk, bukan cuma endpoint.

## Audit keamanan lanjutan (api)

**Ditutup di PR ini (tiap item punya test merah lalu hijau + seeded fault):**

| Sev | Temuan | Perbaikan |
|---|---|---|
| P0 | Login fallback ke `organizations LIMIT 1`/`test-corp` → token tenant sembarang untuk admin global | pakai tenant dari middleware, 403 kalau tidak resolve (`scratch/seeded-fault-login-tenant-fallback`) |
| P0 | WebSocket coverage & audio menerima JWT valid **role apa pun** dan **akun nonaktif** | lewat `AuthorizeApiRequest` seperti HTTP (`...ws-skips-role-check`) |
| P1 | Audio WS mengabaikan expiry invite (bypass fix P1-4) | tolak invite kedaluwarsa |
| P1 | `audio_complete` bisa menutup sesi yang belum mulai lewat invite link | wajib `active?`, else 409 (`...audio-complete-pending`) |
| P2 | Token tanpa `exp` diterima selamanya | `required_claims: ['exp']` (`...jwt-no-exp-required`) |
| P2 | Pesan exception JWT/WS dikirim ke client | pesan generik, detail hanya class di log |

**Sudah aman (dicek, tidak diubah):** mass-assignment ketat (`permit` tanpa `tenant_id`), API key Gemini di header bukan URL, tidak ada secret di `k8s/`, HS256 dipaksa (alg=none ditolak, ada test), IDOR portfolio (ditutup di dev), tenant isolation vacancies/assessments/sessions (test), response login generik (tidak enumerasi akun).

**Putaran audit ke-2 (juga ditutup, semua dengan test merah lalu hijau):**

| Sev | Temuan | Perbaikan |
|---|---|---|
| P0 | Admin di tabel `users` global: admin mana pun bisa minta token tenant lain via `X-Tenant-Scheme` | `users.organization_id`; login, HTTP, dan kedua WS mensyaratkan admin milik tenant itu. Migration reversible, backfill hanya bila tepat 1 organisasi, selain itu fail closed (`...login-ignores-admin-tenant`, `...token-ignores-admin-tenant`) |
| P0 | Dependency rentan: puma 5.6.9, rack 2.2.22, websocket-driver 0.8.0 (DoS di WS), jwt, nokogiri, faraday, addressable (advisory High) | update ke versi ter-patch, puma 7.2 (boot 2 worker diverifikasi); `json` dipin 2.x karena 3.x merusak Rails 7.0 |
| P1 | `Organization.identify` mencocokkan 4 kolom dengan `.first` tanpa urutan (tenant bisa berubah antar-panggilan) | prioritas tetap scheme > identifier > host > alias; test gagal untuk `id ASC` maupun `id DESC` (`...org-identify-unordered`) |
| P1 | Rate limit login hanya per-IP | tambah 10 percobaan / 15 menit per akun, baca email dari body JSON (`...login-email-throttle-off`) |
| P2 | WebSocket tanpa `max_length` (default 64 MB per pesan) | audio 1 MB, coverage 16 KB |
| P2 | `assessor_notes` tanpa batas panjang | maks 2000 karakter |
| P2 | Container jalan sebagai root; hook `on_worker_boot` deprecated di Puma 7 | user non-root, `before_worker_boot` |
| CI | Tidak ada scan otomatis | job `security`: brakeman (0 warning) + bundler-audit (bersih) |

**Belum diubah — perlu keputusan / kerja lintas tim (eskalasi):**
1. **Rails 7.0 EOL** (sejak 2025-04): 12 advisory activestorage/activesupport/activerecord/actionview hanya hilang dengan upgrade ke 7.2+. Diterima sementara di `api/.bundler-audit.yml` dengan alasan; advisory baru tetap menggagalkan CI.
2. Revocation role `assessor` (token dari rakamin-api) masih bolong: tidak ada data lokal untuk dicek, butuh webhook/cache bersama dari app saudara.
3. Invite token kandidat dikirim lewat query string WS (`?token=`) → masuk access log proxy. Solusi yang benar: kirim sebagai pesan `auth` pertama (seperti coverage WS); mengubah protokol FE+BE, jadi dijadwalkan terpisah dengan test WS end-to-end.
4. Upgrade jwt 3.x dan Ruby image `3.3.2` (Dockerfile) belum diuji di luar suite; verifikasi di staging.
5. Env `staging` masih mengembalikan `e.message` mentah pada error 500 (hanya `production` yang disamarkan).
6. ~~Form catatan override belum membatasi 2000 karakter~~ **Ditutup**: `maxLength`, penghitung karakter, dan tombol simpan dinonaktifkan untuk catatan lama yang melebihi batas (`OverridePanel.test.tsx`).
7. ~~Audio WebSocket tidak mencegah koneksi ganda~~ **Ditutup**: `AudioConnectionLock` (Redis `SET NX EX`, TTL 30 dtk, diperpanjang tiap 10 dtk, hanya pemilik yang bisa melepas, fail-open bila Redis mati). Koneksi kedua mendapat `already_connected` (recoverable, agar refresh halaman tetap bisa masuk). 8 spec + seeded fault `ws-lock-not-released`, `ws-lock-not-checked`, `lock-releases-others`.
8. **JWT disimpan di `localStorage`** (`web/src/stores/authAtom.ts`): terbaca oleh script apa pun bila ada XSS. Risiko kecil saat ini karena tidak ada `dangerouslySetInnerHTML`/`innerHTML` di `web/src`. Alternatif (cookie `HttpOnly` + CSRF) mengubah auth FE dan BE, jadi tidak dikerjakan di PR ini.
9. **`audio_websocket_middleware.rb` (800+ baris) belum punya test perilaku end-to-end** (timer, reconnect, transisi coverage). Yang teruji baru autentikasi dan batas ukuran pesan (`spec/channels/`). Ini risiko struktural terbesar yang tersisa; prioritas berikutnya bersama item 3 dan 7.

