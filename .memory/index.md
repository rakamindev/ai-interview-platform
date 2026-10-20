# Project Memory — Index

> Read this file at the start of every task. Keep it under ~150 lines.
> Details live in the files listed in the map below.

## Project summary
Platform AI interview suara milik Rakamin (studi kasus Product Engineer; spek = PRD 01 & 02 di GitHub wiki repo). Assessor menyusun assessment (skill + scope + anchor L1–L5 + expected level). Kandidat diwawancarai suara oleh AI (Gemini Live) lewat link undangan. Coverage skill terpantau live. Setelah sesi, LLM menyusun portfolio (level, confidence, kutipan bukti); assessor bisa override, membandingkan dengan vacancy (fit/gap), dan export PDF/JSON.
- `api/` Rails 7.0 API-only + Postgres (DB bersama `rakamin-api`, schema `ai_interview`) + Sidekiq/Redis, port 3001. `web/` React 18 + TS + Vite 6 + Tailwind/Radix, port 5173.
- Tahap: studi kasus Product Engineer (Step 1–6). Konteks 5 pilar dan Step 3 selesai; tabel temuan + acceptance criteria di `assessment/findings.md`. Eksekusi Step 5 belum dimulai.

## Rules & preferences
- Agent TIDAK PERNAH commit, push, atau membuat PR — user yang melakukannya sendiri.
- Nilai produk dari pemakaian end-to-end, bukan dari apa yang tersirat di kode; tandai temuan dari kode sebagai hipotesis sampai diverifikasi runtime.
- Rancang juga untuk kandidat (tidak memilih, tidak bisa opt-out) dan patuhi UU PDP — lihat topics/pillar-5-candidates-uupdp.md.
- Acuan: 5 pilar (topics/pillar-*.md) + PRD. Deliverable tertulis → folder `/assessment` di root (README repo).
- Dokumen .md ditulis gaya product engineer: Bahasa Indonesia wajar, bukan terjemahan kaku. AC di `assessment/findings.md` = sumber kebenaran eksekusi; perilaku baru ditulis di sana dulu.
- Memori ditulis dalam Bahasa Indonesia; istilah teknis & path apa adanya. Klaim riset wajib bersumber (URL) atau ditandai `[INFERENCE]`/`[UNVERIFIED]`.

## Key facts
- Stack: Ruby 3.3.2 / Rails 7.0.10, PostgreSQL, Sidekiq 7 + Redis, faye-websocket + EventMachine (bukan ActionCable); React 18, TS 5.5, Vite 6, Jotai, axios; Gemini Live/Flash/Pro.
- PRD: `git clone https://github.com/rakamindev/ai-interview-platform.wiki.git` (tidak ada di repo).
- Jalankan lokal (tanpa Docker), panduan lengkap + kapan restart: `api/README.md`. Ringkas: `api/` → `bundle install`, `bin/rails db:create db:migrate db:seed`, buat user admin manual, `bin/rails server` + `bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml` (satu baris, satu proses); `web/` → `pnpm install && pnpm dev`. Jebakan setup: gotchas.md; kondisi mesin: local.md.
- Test/lint/CI: belum ada (RSpec terpasang tanpa spec; web tanpa test runner). Satu-satunya check web: `npm run build` (tsc).
- Secret: `api/config/application.yml` (Figaro) & `web/.env` — gitignored; jangan pernah tulis nilainya.
- File paling kompleks/berisiko: `api/app/channels/audio_websocket_middleware.rb`, `api/app/clients/gemini/live_client.rb`, `api/app/services/portfolios/generator.rb`, `web/src/pages/interview/InterviewPage.tsx`.

## Map
- progress.md — current status, next steps, blockers
- decisions.md — why things are the way they are
- gotchas.md — arahan user, jebakan setup, perilaku kode
- topics/codebase.md — scan repo (refresh: mem.sh scan) + peta arsitektur, data model, alur & file kunci, config
- topics/pillar-1-product.md — apa yang produk lakukan (PRD), spek yang hilang, beda PRD↔kode, layar kandidat, hipotesis yang harus diuji end-to-end
- topics/pillar-2-industry.md — pasar hiring Indonesia, apa yang sulit, yang sudah komoditas, di mana leverage
- topics/pillar-3-purpose.md — outcome produk, syarat agar tetap berguna, cara menjangkau lebih banyak orang, pertanyaan terbuka
- topics/pillar-4-users.md — recruiter, assessor, hiring manager: hari kerja, JTBD, kebutuhan, pemicu berhenti
- topics/pillar-5-candidates-uupdp.md — posisi kandidat, pasal UU PDP & PP 33/2026, cek produk (16 gap), prinsip desain kandidat
- topics/step3-gap-and-plan.md — masalah inti, temuan P0–P3 (bukti runtime), constraint signal, opsi revamp
