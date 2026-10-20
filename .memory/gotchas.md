# Gotchas

> A curated runbook, not a log. Highest priority first; max 10 entries per section.
> Every entry needs a "Do instead". Format:
> `1. **[YYYY-MM-DD] Short rule** #tag @path/ (user|agent, seen: N)`
> `   Do instead: concrete action.`
> Rename or add sections to fit the project.

## User directives
1. **[2026-10-19] Commit & push hanya dilakukan user sendiri — agent tidak pernah commit, push, atau membuat PR** #git (user, seen: 3)
   Do instead: biarkan perubahan di working tree, tunjukkan ringkasan/diff, lalu serahkan ke user. Jangan `git add`/`commit`/`push`/`gh pr create` walaupun diminta "selesaikan".
2. **[2026-10-19] Bangun konteks lewat 5 pilar (product, industry, purpose, users, candidates + UU PDP); nilai produk dari pemakaian end-to-end, bukan dari apa yang tersirat di kode** #context (user, seen: 2)
   Do instead: temuan dari membaca kode ditandai hipotesis sampai diverifikasi runtime; lihat topics/pillar-*.md.
3. **[2026-10-20] Semua dokumen .md ditulis dari sudut pandang product engineer: Bahasa Indonesia yang wajar, bukan terjemahan kaku, mudah dipahami** #docs (user, seen: 1)
   Do instead: kalimat pendek dan langsung ke dampak; istilah teknis tetap Inggris bila lebih lazim (payload, endpoint, override); hindari padanan kaku seperti "implementasi yang cacat". Contoh gaya: `assessment/findings.md`.
4. **[2026-10-20] Acceptance criteria di `assessment/findings.md` adalah sumber kebenaran eksekusi** #revamp @assessment/findings.md (user, seen: 1)
   Do instead: sebelum menulis kode, cocokkan ke ID AC (AC-D/G/F/S/W/T); perilaku yang belum tertulis → tambahkan ke findings.md dulu, jangan mengarang.

## Build, test & tooling
1. **[2026-10-19] Lingkungan lokal tanpa Docker: Ruby 3.3.2 via rbenv, Postgres & Redis host** #setup @api/ (agent, seen: 2)
   Do instead: `bundle install` di `api/` (Bundler 2.5.11); `bin/rails db:create db:migrate db:seed` (jangan `db:schema:load` — `schema.rb` tidak membuat schema `ai_interview`); detail mesin di `.memory/local.md`.
2. **[2026-10-19] `api/bin/rails|rake|bundle` ter-commit 100644 → `permission denied`** #setup @api/bin/ (user, seen: 1)
   Do instead: `chmod +x api/bin/{rails,rake,bundle}` (sudah di working tree, menunggu commit user) atau `bundle exec rails …`.
3. **[2026-10-16] Seed tidak membuat User; login hanya role `admin`** #auth #setup @api/db/seeds.rb (agent, seen: 2)
   Do instead: `bin/rails runner 'User.create!(email: "...", password: "...", role: "admin")'`. Endpoint `/signup` yang dipanggil web tidak ada.
4. **[2026-10-16] Default web ke port 3000; API jalan di 3001; `APP_BASE_URL` harus origin web** #setup @web/.env.example @api/config/application.yml.sample (agent, seen: 2)
   Do instead: `VITE_API_BASE_URL=http://localhost:3001/api/v1`, `VITE_WS_BASE_URL=ws://localhost:3001`; `APP_BASE_URL=http://localhost:5173` (invite link = route React `/interview/:token`).
5. **[2026-10-20] Setelah ubah `application.yml`/`config/*`/`app/channels/*`, restart Rails DAN Sidekiq; jalankan tepat satu Sidekiq** #setup @api/README.md (user, seen: 2)
   Do instead: panduan restart & troubleshooting di `api/README.md` §4 (ditulis ulang 2026-10-20). Dua Sidekiq berbagi antrean Redis → proses lama dengan config basi tetap mengambil job (terjadi 2026-10-20: coverage tetap 404 setelah ganti model). Cek `ps -ax | grep sidekiq`.
6. **[2026-10-20] Nama model Gemini kedaluwarsa: masih muncul di ListModels tapi `generateContent` → 404 "no longer available to new users"** #gemini @api/config/application.yml (agent, seen: 1)
   Do instead: uji model dengan `Gemini::HttpClient.new(model: ...).generate_content("Reply OK")` via `bin/rails runner`; pakai pengganti yang disarankan pesan error. 2026-10-20: FLASH `gemini-2.5-flash-lite` → `gemini-3.5-flash-lite`; PRO `gemini-3.8-flash` (151 s / timeout 180 s) → `gemini-3.5-flash` (~8 s); `gemini-2.5-pro` 404.
7. **[2026-10-16] Belum ada test harness, lint, maupun CI** #test @api/.rspec @web/package.json (agent, seen: 2)
   Do instead: `.rspec` me-require `spec_helper` yang belum ada → `rails generate rspec:install` dulu; web butuh test runner baru (mis. Vitest).
8. **[2026-10-20] Puma cluster mode di macOS → worker crash-loop (`objc ... fork() was called ... Crashing instead`)** #setup @api/config/puma.rb (agent, seen: 1)
   Do instead: thread EventMachine sudah jalan sebelum fork. `config/puma.rb` kini default `workers 0` di development (production tetap `WEB_CONCURRENCY=2` dari k8s); jalankan `bin/rails server` tanpa `WEB_CONCURRENCY`. Gejala: log berulang `[EM] EventMachine reactor started`, request dapat empty reply.

## Domain & code behaviour
1. **[2026-10-16] Tenant scope otomatis hanya di Assessment, Session, Vacancy** #tenancy @api/app/models/ (agent, seen: 1)
   Do instead: akses Portfolio/PortfolioSkill/FitGapReport/CoverageMap/TranscriptTurn lewat parent yang sudah di-scope, bukan `Model.find(params[:id])`.
2. **[2026-10-16] WebSocket = Rack middleware faye-websocket di satu thread EventMachine, bukan ActionCable** #realtime @api/app/channels/ (agent, seen: 1)
   Do instead: jangan blok reactor; DB/Redis/HTTP lewat `Thread.new` + `connection_pool.with_connection` seperti pola yang ada.
3. **[2026-10-19] PRD di wiki, bukan di repo** #product (agent, seen: 1)
   Do instead: `git clone https://github.com/rakamindev/ai-interview-platform.wiki.git` — PRD 01 (perilaku AI) & PRD 02 (simulasi end-to-end); ringkasan di topics/pillar-1-product.md.
4. **[2026-10-20] Error di `on:open` WS audio wajib mengirim `{type:"error", recoverable:false}` sebelum `close`** #realtime #candidate @api/app/channels/audio_websocket_middleware.rb (agent, seen: 1)
   Do instead: tanpa pesan itu client menganggapnya putus jaringan dan reconnect tanpa batas; sesi yang belum `active` jangan diakhiri oleh grace timer (link kandidat hangus). Label skill per assessment harus unik (unique index `coverage_maps`). Detail: topics/pillar-1-product.md §Temuan runtime.
