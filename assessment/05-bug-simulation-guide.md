# Bug Simulation Guide — main (buggy) vs fix/portfolio-delivery-reliability

Dokumen ini adalah panduan langkah-demi-langkah untuk **membuktikan perbaikan** pada
branch `fix/portfolio-delivery-reliability` dibandingkan `main`, dalam bentuk demo
yang bisa dijalankan ulang kapan saja (misalnya saat interview).

Dua bug utama yang diperbaiki:

| ID | Bug di `main` | Perbaikan di branch fix |
|----|---------------|--------------------------|
| P1-01 | Portfolio tersangkut `pending`/`generating` selamanya, tanpa recovery & tanpa tombol retry | TTL 15 menit, self-heal saat di-read, tombol Retry, banner "taking longer than expected" (30s) |
| P1-02 | `end_session` konkuren → 500 `RecordNotUnique` + job N10 ganda | `with_lock` serialisasi → selalu 200, tepat 1 job |

Bonus yang juga dibuktikan:
- `end_reason` upgrade `error`→`manual` sebelumnya tidak pernah persist.
- `pending?` predicate tidak ada di model → `show` salah menampilkan portfolio `pending`.
- Phantom skills ter-reinsert setelah rollback gagal.
- Internet speed test spinner "Checking…" selamanya karena `fetch` tanpa timeout.

---

## 1. Topologi Setup (sudah disiapkan di mesin ini)

Dua worktree terpisah — **dua branch dijalankan bergantian**, jangan bersamaan
(karena sama-sama memakai port 3000/5173 dan satu database `rakamin_development`):

```
/path/to/ai-interview-platform   → fix/portfolio-delivery-reliability  (branch perbaikan)
/path/to/ai-interview-main       → main                                (branch buggy)
```

Kedua branch memakai **database dev yang sama** (`rakamin_development`). Karena
schema-nya berbeda (fix punya 2 kolom tambahan), tiap kali pindah branch wajib
reset DB (langkah 3).

### Prasyarat mesin
- Ruby 3.3.2 (rbenv), Postgres, Redis — sudah jalan
- macOS workaround: `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES` saat start Rails
  (menghindari crash `objc_initializeAfterForkError` saat puma fork)
- Web memakai `VITE_API_BASE_URL` dari `web/.env` — pastikan berisi port API yang
  sedang aktif (lihat langkah 3, poin e)

---

## 2. Boot ulang kedua branch (quick reference)

### Branch fix (perbaikan)
```bash
# Terminal API
export PATH="$HOME/.rbenv/shims:$PATH"
OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES bundle exec rails server -p 3000   # api fix

# Terminal web (dari folder fix)
cd web && npm run dev                                                        # → :5173
```

### Branch main (buggy)
```bash
cd /path/to/ai-interview-main/api
export PATH="$HOME/.rbenv/shims:$PATH"
OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES bundle exec rails server -p 3000

cd /path/to/ai-interview-main/web && npm run dev
```

> **Sidekiq sengaja TIDAK dijalankan** pada demo P1-01 — tujuannya membuat job
> N10 mengendap sehingga portfolio terlihat "stuck". Untuk demo sukses-path,
> jalankan `bundle exec sidekiq` di terminal terpisah.

---

## 3. Reset database per branch

```bash
# (a) Switch dulu ke branch yang mau di-demo (opsional; via worktree lain)
# (b) Drop + recreate + load schema + seed
export PATH="$HOME/.rbenv/shims:$PATH"
cd <folder api branch target>
bundle exec rails db:drop db:create db:schema:load db:seed

# (c) Admin user + satu assessment (seed bawaan tidak membuat User)
bundle exec rails runner '
org_row = ActiveRecord::Base.connection.select_one("SELECT id FROM public.organizations WHERE scheme = \u0027test-corp\u0027 LIMIT 1")
Current.tenant_id = org_row["id"].to_i
RequestStore.store[:tenant_id] = Current.tenant_id
admin = User.find_or_initialize_by(email: "admin@testcorp.com")
admin.password = "password123"; admin.role = "admin"; admin.save!
Assessment.find_or_create_by!(name: "Fullstack Engineer Assessment") { |r| r.created_by = admin.id; r.time_limit_min = 60; r.language = "en" }
puts "users=#{User.count} assessments=#{Assessment.count}"
'

# (d) KHUSUS branch fix — dua kolom tambahan tidak ada di schema main, jadi migrate:
bundle exec rails db:migrate

# (e) Pastikan web/.env mengarah ke port yang dipakai API:
#     VITE_API_BASE_URL=http://localhost:3000/api/v1
#     VITE_WS_BASE_URL=ws://localhost:3000
#     (file ini TIDAK di-commit; jangan lupa restart `npm run dev` setelah edit)
```

> Menjalankan step (b) pada `main` akan **menghapus kolom tambahan** dari DB,
> dan sebaliknya step (d) menambahkannya kembali. Inilah alasan wajib reset tiap
> pindah branch.

---

## 4. Menyiapkan token & session uji

```bash
# Token admin (hasil login)
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@testcorp.com","password":"password123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# Buat session baru (active)
curl -s -X POST http://localhost:3000/api/v1/assessments/1/sessions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"session":{"candidate_name":"Demo Candidate"}}'
```

---

## 5. DEMO P1-01 — Portfolio stuck selamanya (vs self-heal + retry)

### Di branch `main` (buggy)

1. **Jangan** jalankan Sidekiq.
2. End session → portfolio jadi `pending`, job N10 menunggu di queue:
   ```bash
   curl -s -X POST http://localhost:3000/api/v1/sessions/<SESSION_ID>/end_session \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
   ```
3. Buka portfolio:
   ```bash
   curl -s http://localhost:3000/api/v1/sessions/<SESSION_ID>/portfolio \
     -H "Authorization: Bearer $TOKEN"
   ```
   Hasil: status tetap `pending` → `show` salah menampilkan sebagai portfolio
   biasa (200), **bukan** "generating" (karena predicate `pending?` tidak ada).
4. Coba regenerate:
   ```bash
   curl -s -X POST http://localhost:3000/api/v1/sessions/<SESSION_ID>/portfolio/regenerate \
     -H "Authorization: Bearer $TOKEN"
   ```
   Hasil: **422** `"Portfolio can only be regenerated when status is 'failed'"`.
   → **Tidak ada jalan keluar**: stuck selamanya.

**Di UI (`localhost:5173`)** — buka Live Monitor → **End Session** → buka
tab **Portfolio**: spinner "Generating…" berputar selamanya, polling 5 detik,
tanpa timeout, tanpa tombol Retry (tombol hanya muncul di state `failed`).

### Di branch `fix` (perbaikan)

1. **Jangan** jalankan Sidekiq (biar terlihat recovery-nya bekerja).
2. End session → portfolio `pending` (sama seperti main).
3. Buka portfolio → **read-path self-heal** terpicu: karena umur portfolio sudah
   lewat TTL, `Portfolios::Recovery` otomatis me-requeue:
   ```bash
   curl -s http://localhost:3000/api/v1/sessions/<SESSION_ID>/portfolio -H "Authorization: Bearer $TOKEN"
   # → 202 {"status":"generating"}  (bukan 200 aneh seperti main)
   ```
4. Regenerate kini boleh dari `pending`/`generating`/`failed`:
   ```bash
   curl -s -X POST http://localhost:3000/api/v1/sessions/<SESSION_ID>/portfolio/regenerate \
     -H "Authorization: Bearer $TOKEN"
   # → 200 "Portfolio generation queued"
   ```
5. **Sweep manual** (contoh TTL > 15 menit dulu untuk melihat kerja sweep):
   ```bash
   bundle exec rails runner 'p = Portfolio.first; p.update!(generation_status: "generating", generation_attempted_at: 20.minutes.ago); puts Portfolios::Recovery.new.recover!'
   # → memindahkan kembali ke pending + re-enqueue
   ```
6. `bin/rails portfolios:recover` — rake task publik untuk menjalankan sweep.

**Di UI (`localhost:5173`)** — buka Portfolio:
- ≤30 detik: spinner normal.
- >30 detik: banner berubah jadi **"Taking longer than expected"** + tombol
  **Retry generation** → klik → regenerate → polling lanjut.
- Kalau job gagal: state `failed` menampilkan `generation_error` + tombol Retry.
- Tombol export/download hanya muncul saat `complete`.

### Bukti kolom baru (perbaikan)
```bash
bundle exec rails runner 'puts Portfolio.columns.map(&:name)'
# main : session_id, candidate_id, generation_status, generated_at, generation_error
# fix  : + generation_attempted_at, created_at, updated_at
```

---

## 6. DEMO P1-02 — `end_session` konkuren → 500 + job ganda (vs serialized)

### Di branch `main` (buggy)

Karena `portfolios.session_id` punya **unique index** dan `EndHandler` **tidak
memakai row lock**, beberapa `end_session` paralel akan tabrakan:

```bash
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  curl -s -o /dev/null -w "req$i: %{http_code}\n" \
    -X POST "http://localhost:3000/api/v1/sessions/<SESSION_ID>/end_session" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}' &
done
wait
```

Hasil yang diharapkan:
- Sebagian `200`, sebagian **`500`** (RaceCondition / RecordNotUnique).
- Di **Sidekiq dashboard** (`localhost:3000/sidekiq`): beberapa job N10 untuk
  session yang sama → Gemini dipanggil berkali-kali.

> Di UI, versi realistis: buka Live Monitor di **2 tab browser**, klik **End
> Session** di detik yang sama (skenario assessor + candidate mengakhiri
> bersamaan).

### Di branch `fix` (perbaikan)

Script yang sama, hasilnya:
- **Semua `200`** — `with_lock` membuat request kedua menunggu, lalu melihat
  session sudah `ended` → idempotent no-op.
- Sidekiq: **tepat 1 job** per session.

### Bukti tambahan — end_reason upgrade yang sebelumnya tak pernah persist
```bash
# main: session error → coba manual, end_reason tetap 'error' (update_column di luar tx / return memotong commit)
# fix : end_reason menjadi 'manual_assessor' dan tersimpan
bundle exec rails runner 's = Session.find(<ID>); s.update!(status: "ended", end_reason: "error", ended_at: Time.current); Sessions::EndHandler.new(s).call(reason: "manual_assessor"); puts Session.find(s.id).end_reason'
```

---

## 7. DEMO internet speed test (spinner "Checking…" selamanya)

**Sebelum fix:** `measurePing`/`measureDownloadSpeed` memanggil CDN eksternal
(google, jsdelivr, unpkg, httpbin) dengan `fetch` tanpa timeout → jika endpoint
lambat/terblokir, `await fetch` menggantung tanpa batas → status Internet di
HardwareCheck tetap **"Checking…"** selamanya.

**Setelah fix** (`web/src/utils/internetSpeedTest.ts`):
- `fetchWithTimeout` (AbortController, 5 detik) di semua permintaan — tidak
  pernah menggantung, selalu jatuh ke fallback.
- `SKIP_INTERNET_TEST` default `true` (`VITE_SKIP_INTERNET_TEST !== "false"`)
  → Internet langsung **Passed** tanpa test. Untuk mengaktifkan test asli:
  `VITE_SKIP_INTERNET_TEST=false npm run dev`.

---

## 8. Checklist sebelum demo interview

- [ ] API + web berjalan dari branch yang benar (cek `localhost:3000/health` → 200)
- [ ] `web/.env` menunjuk ke port yang dipakai API
- [ ] DB sudah di-reset sesuai branch (langkah 3)
- [ ] Sidekiq dimatikan untuk demo stuck (kecuali demo success-path)
- [ ] Sudah ada 1 session aktif (langkah 4)
- [ ] `TOKEN` sudah di-generate & masih valid (`exp` di JWT)
- [ ] Untuk demo UI: login `admin@testcorp.com` / `password123`
- [ ] Port 3001 tidak terpakai (sisa sesi lama) — cek `lsof -iTCP:3001`

## 9. Perintah praktis

```bash
# Health
curl -s http://localhost:3000/health

# Lihat status queue Sidekiq: http://localhost:3000/sidekiq

# Jalankan sweep manual
cd api && bin/rails portfolios:recover

# Log server
tail -f /tmp/ai-fix-api.log     # fix
tail -f /tmp/ai-fix-web.log
tail -f /tmp/ai-main-api.log    # main (worktree)
```
