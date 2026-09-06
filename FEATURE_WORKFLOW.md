# Feature Workflow

Prosedur untuk menambah fitur baru di monorepo ini (Rails API `api/` + React SPA `web/`).

## A. Syarat Awal Sebelum Menambah Fitur (preflight)

Pastikan semua ini hijau SEBELUM mulai coding — kalau setup salah, fitur baru akan sulit didiagnosis.

1. **File environment ada:**
   - `api/config/application.yml` — isi `SECRET_KEY_BASE`, `DB_*`, `GEMINI_*`, `REDIS_URL`, `ALLOWED_ORIGINS`, `APP_BASE_URL`
   - `web/.env` — isi `VITE_API_BASE_URL` (→ `http://localhost:3001/api/v1`), `VITE_WS_BASE_URL`, `VITE_DEV_TOKEN`, `VITE_DEV_TENANT_ID/NAME`
   - Kedua file sudah di-.gitignore — tidak akan ke-commit.
2. **`SECRET_KEY_BASE` di api HARUS match `rakamin-api`** — JWT token dibagi lintas service.
3. **Service jalan, urutan:**
   ```
   Redis (docker, port 6379) → Sidekiq → Rails (port 3001) → Web (port 5173)
   ```
4. **Baseline hijau dulu** — pastikan tidak ada error pre-existing:
   - `bundle exec rubocop` (dari `api/`)
   - `npm run build` (dari `web/`; tsc + vite build)
5. **Port 3001 / 5173** — jangan ubah tanpa update dua sisi (config + env + README).
6. **Database:** tabel fitur lama — kalau nambah tabel/kolom, jalankan `rails db:migrate` (schema `ai_interview`, search path `ai_interview,public`).

## B. Workflow Commit — Convention

Repositori ini memakai **Conventional Commits** untuk semua commit fitur baru.

Format:

```
type(scope): subject
```

- **type**: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `style`
- **scope**: service yang berubah — `api` atau `web`. Untuk dua-duanya, pilih scope yang utama.

Contoh:

```
feat(api): add webhook delivery endpoint
feat(web): add webhook config page
fix(api): correct session time_limit validation
refactor(web): extract vacancy skill picker component
```

### Urutan sebelum membuat commit

1. `git status` — lihat apa yang berubah.
2. `git diff` — review perubahan; **hapus/stage hanya yang intended**, jangan commit secret atau key.
3. **Verify sebelum commit:**
   - Ada perubahan di `api/` → `bundle exec rubocop`
   - Ada perubahan di `web/` → `npm run build`
4. `git add` hanya file yang memang bagian dari fitur.
5. Buat commit — **satu commit per fitur/fix**, jangan campur banyak hal.

### Aturan pesan commit

- Subject ≤ 50 karakter.
- Kalimat **imperative** (`add`, `fix`, `remove`, bukan `added`, `fixing`).
- No trailing period.
- Body hanya ditulis bila "kenapa" tidak jelas dari subject — single-line commit cukup untuk perubahan kecil.

### Jangan pernah commit

- `config/application.yml`, `web/.env`, `*.env.local` (sudah di-.gitignore)
- `master.key`, `vertex_ai_credentials.json`, API key apa pun
- `Gemfile.lock`/`package-lock.json` hanya bila perubahan dependencies sengaja

> Catatan: konvensi ini baru untuk repo (history lama memakai gaya bebas, `Initial import` / `Revise...`). Mulai gunakan conventional commit untuk semua commit fitur baru ke depan.
