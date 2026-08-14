# Setup Lokal & Tech Stack

Repo: https://github.com/rakamindev/ai-interview-platform
Checkout lokal: `/Volumes/Lexar/rakamin/ai-interview-platform` (branch `explore/setup`)

> Catatan: repo ini ada di drive eksternal exFAT. `git clone` di situ kadang gagal —
> macOS bikin file shadow AppleDouble (`._pack-*.idx`) di sebelah file pack git, dan
> scan direktori pack git kadang salah baca file shadow itu sebagai index asli,
> muncul error `error: non-monotonic index`. Kalau clone/fetch gagal dengan error itu,
> clone ulang (atau kerja) di volume APFS/internal. Setelah ke-clone, operasi git
> harian kelihatannya jalan normal.

---

## Tech Stack

### `api/` — Backend

| Layer | Pilihan |
|---|---|
| Bahasa | Ruby 3.3.2 (`.ruby-version`) |
| Framework | Rails ~> 7.0.8, web server Puma |
| Database | PostgreSQL (gem `pg`) |
| Background job | Sidekiq 7 + Redis 5 |
| Auth | JWT (gem `jwt`) + `bcrypt`, secret sama dengan `rakamin-api` |
| Multi-tenancy | `request_store` (tenant context per-request) |
| AI | Google Gemini — 3 tingkat model: `GEMINI_LIVE_MODEL` (interview realtime), `GEMINI_ANALYSIS_MODEL` (analisis coverage), `GEMINI_PRO_MODEL` (portfolio/scoring). Dipanggil lewat REST pakai `faraday` + `faraday-retry`. |
| Realtime | `faye-websocket` (streaming audio Gemini Live + socket sesi kandidat) |
| Export PDF | `prawn` + `prawn-table` |
| Pengaman API | `rack-attack` (rate limiting), `rack-cors` |
| Konfigurasi env | `figaro` (`config/application.yml`) |
| Tooling test terpasang tapi gak dipakai | `rspec-rails`, `factory_bot_rails`, `faker`, `database_cleaner`, `timecop` — **belum ada satupun file spec** |
| Lint | `rubocop`, `rubocop-rails`, `rubocop-rspec` (dev saja) |

### `web/` — Frontend

| Layer | Pilihan |
|---|---|
| Framework | React 18.3 + TypeScript 5.5, Vite 6 |
| Styling | Tailwind CSS 3.4 + `tailwindcss-animate` |
| UI primitive | Radix UI (accordion, dialog, dropdown, select, tabs, tooltip, dll) — style wrapper ala shadcn/ui |
| State | Jotai (atom buat auth/tenant) |
| Form/validasi | React Hook Form + Zod (`@hookform/resolvers`) |
| HTTP | Axios |
| Routing | React Router DOM 7 |
| Drag & drop | `@dnd-kit/*` |
| Icon | `lucide-react` |
| Tooling test | **belum ada** — gak ada Vitest/Jest/RTL, gak ada script `test` di `package.json` |

Belum ada config CI (gak ada `.github/workflows`) di kedua service, sejauh checkout ini.

---

## Prasyarat

- Ruby 3.3.2 — pakai `rbenv`/`asdf`/`rvm` (Ruby sistem biasanya lebih lawas, cek pakai `ruby -v`)
- Node.js 18+ dan npm
- PostgreSQL jalan lokal (atau via Docker)
- Redis (`api/README.md` sarankan Docker: `redis:alpine`)
- API key Gemini (Google AI Studio) buat `GEMINI_API_KEY`

---

## Jalanin API (`api/`)

```bash
cd api
cp config/application.yml.sample config/application.yml
# isi: SECRET_KEY_BASE, DB_*, GEMINI_API_KEY, GEMINI_*_MODEL, REDIS_URL,
#      ALLOWED_ORIGINS=http://localhost:5173, APP_BASE_URL=http://localhost:3001

bundle install

rails db:create      # skip kalau DB udah ada
rails db:migrate
rails db:seed

docker run -d -p 6379:6379 --name redis redis:alpine
bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml   # terminal terpisah

bundle exec rails server   # http://localhost:3001
```

`SECRET_KEY_BASE` harus sama dengan `rakamin-api` — token JWT dipakai bareng lintas
service (platform ini nempel ke sistem auth Rakamin yang lebih besar, bukan
self-contained penuh).

## Jalanin web app (`web/`)

```bash
cd web
npm install
cp .env.example .env
```

Isi `.env`:

```env
VITE_API_BASE_URL=http://localhost:3001/api/v1
VITE_WS_BASE_URL=ws://localhost:3001
VITE_DEV_TOKEN=<jwt dari rakamin auth>
VITE_DEV_TENANT_ID=1
VITE_DEV_TENANT_NAME=Demo Tenant
```

```bash
npm run dev   # http://localhost:5173
```

Halaman interview butuh izin mic (opsional kamera) — test di browser yang dukung
`getUserMedia` + `AudioWorklet` (disaranin Chrome/Edge).

## Urutan jalanin

Redis → Sidekiq → Rails API → Vite dev server. Web app butuh API nyala buat auth,
manajemen sesi, dan WebSocket audio live.
