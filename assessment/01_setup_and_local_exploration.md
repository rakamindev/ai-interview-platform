# Step 1: Setup & Local Exploration

## Arsitektur

**AI Interview Platform** — interview kerja via percakapan suara real-time (Gemini Live API), hasilnya dianalisis jadi *portfolio* skill dan *fit/gap report* terhadap vacancy.

- **`api/`**: Rails 7 API mode, Ruby 3.3.2, PostgreSQL (skema `ai_interview`), Redis + Sidekiq (audio processing, portfolio/fit-gap generation), Faye-WebSocket (audio & coverage map real-time), Prawn (PDF export).
- **`web/`**: React 18 + Vite 6 + TypeScript, Tailwind + Radix UI, Jotai.

Baseline sebelum disentuh: **nol RSpec spec, nol test runner frontend, nol CI.**

## Cara Menjalankan (Docker Compose — terverifikasi jalan)

```bash
docker compose up -d --build              # postgres, redis, api, sidekiq
docker compose exec api bundle exec rails db:seed
curl http://localhost:3001/api/v1/health  # {"status":"ok"}

cd web && cp .env.example .env            # isi VITE_API_BASE_URL=http://localhost:3001/api/v1
npm install && npm run dev                # localhost:5173
```

Diverifikasi: 4 container sehat (`postgres`, `redis`, `api`, `sidekiq`), health check OK, `db:seed` sukses, endpoint terautentikasi merespons benar, dan **12 spec RSpec dari Step 5 lolos di dalam container** (`docker compose exec api rspec`) — konfirmasi `api/Dockerfile.dev` benar meng-include grup gem `:test`.

Fallback native (Homebrew Postgres/Redis + rbenv Ruby 3.3.2) juga sudah diverifikasi jalan; satu catatan: Puma cluster mode crash di macOS (fork-safety Objective-C) — perlu `WEB_CONCURRENCY=0`. Tidak muncul di container Linux.

Frontend sengaja tetap native (Vite HMR) di kedua pendekatan.

## Eksplorasi Produk

Masuk sebagai assessor (dev JWT) → buat assessment + skill dari taxonomy B7 → undang kandidat → **link undangan yang dihasilkan 404** (mengarah ke port backend, bukan frontend — temuan **F1**, lihat [`03_defining_problem_and_gap_to_ideal_condition.md`](03_defining_problem_and_gap_to_ideal_condition.md)). Eksplorasi berlanjut ke Live Monitor, Portfolio, dan Fit/Gap Report — masing-masing menyingkap F2–F6. Setiap temuan diverifikasi lewat kode sumber, bukan dugaan dari UI saja.

## Catatan UU PDP

Seed data sepenuhnya sintetis. `GEMINI_API_KEY` dummy — fitur AI real-time tidak diuji end-to-end, sebagian temuan soal alur AI berbasis pembacaan kode (ditandai eksplisit di dokumen findings). `config/application.yml` tetap gitignored.
