# Catatan untuk Kamu — Sebelum Mulai Coding

## Apa yang sebenarnya harus dikerjakan

Codebase ini **bukan** stub kosong seperti diimplikasikan brief — hampir semua mekanisme
inti PRD (system prompt generation, WebSocket ke Gemini Live, coverage injection, portfolio
generator, fit/gap, reconnection) sudah ada dan sebagian besar kualitasnya bagus, bahkan
melebihi spek di beberapa tempat. Tugasmu sekarang **bukan membangun fitur dari nol**, tapi
memilih 1-2 temuan spesifik dari `codebase-audit.md` §6 (mulai dari F-01: celah tenant di
`Portfolio`/`PortfolioSkill`/`FitGapReport` yang bisa bocor lintas organisasi, atau F-03:
kebocoran hidden signal ke transkrip AI) lalu memperbaikinya dengan rapi dan **dibuktikan
dengan test** — bukan menyebar tipis ke banyak hal sekaligus. Baca tabel opsi di §7 sebelum
memutuskan; jangan mulai coding sebelum memilih satu-dua opsi secara sadar.

## Jebakan terbesar yang bisa membuang waktumu

1. **Jangan re-explore ulang dari nol.** Semua peta arsitektur, file, dan baris kode relevan
   sudah ada di `codebase-audit.md`. Kalau kamu mulai baca ulang seluruh `api/app/` dari
   awal, itu waktu yang terbuang — kamu akan menemukan hal yang sama.
2. **Database di sini bukan milik sendiri** — di-share dengan sistem eksternal "rakamin-api"
   (lihat komentar di banyak file, `api/README.md`, dan `config/database.yml`).
   `SECRET_KEY_BASE` harus cocok dengan sistem itu, dan tabel `organizations` hidup di
   schema `public` yang mereka juga pakai. Jangan "menyederhanakan" bagian tenant/auth tanpa
   sadar ini — sepertinya kelihatan aneh/berlebihan tapi itu constraint nyata, bukan
   over-engineering yang aman dihapus.
3. **Environment lokal belum tentu langsung jalan.** Saya tidak bisa menjalankan
   PostgreSQL/Redis/Docker di sesi audit ini (semuanya tidak tersedia), jadi seluruh temuan
   soal data (§3) berbasis baca skema, bukan query nyata. Cek dulu setup lokalmu sendiri
   (ikuti `api/README.md`) di awal, sebelum menghitung sisa 36 jam — kalau setup saja makan
   2-3 jam, itu perlu masuk hitungan.
4. **Kalau kamu pilih perbaiki F-03 (channel B6)**: itu butuh Gemini API key asli + test
   suara langsung di browser untuk diverifikasi — tidak bisa dipastikan benar hanya dari
   baca kode. Pastikan kamu punya API key dan waktu untuk iterasi manual sebelum
   mengalokasikan effort besar ke opsi ini.
5. **RSpec belum pernah dipakai** meski gem-nya (`rspec-rails`, `factory_bot_rails`) sudah
   ada di `Gemfile`. Bootstrap pertama kali (`rails_helper.rb`, koneksi test DB, factory
   pertama) di Rails punya beberapa konvensi non-obvious buat yang baru — alokasikan waktu
   ekstra untuk ini kalau opsimu butuh test, jangan asumsikan itu 15 menit.

## Pertanyaan yang perlu kamu jawab sendiri (bukan keputusan AI)

1. **Untuk submission case study ini**: apakah reviewer (Rakamin) mengharapkan bug
   benar-benar diperbaiki+diuji, atau cukup didokumentasikan dengan rencana yang jelas?
   Ini menentukan berapa banyak dari 36 jam yang realistis dialokasikan ke coding vs
   penulisan strategi.
2. **Kebijakan retensi data kandidat (F-02)** — berapa lama data seharusnya disimpan, siapa
   yang berwenang menghapus, apakah ada kewajiban hukum/kontraktual spesifik. Ini keputusan
   produk/legal, bukan sesuatu yang bisa saya asumsikan atau putuskan lewat baca kode.
3. **Prioritas strategi 36 jam**: cakupan (sentuh banyak temuan secara dangkal, tunjukkan
   awareness luas) vs kedalaman (1-2 temuan diperbaiki + diuji tuntas, tunjukkan
   craftsmanship)? Lihat trade-off di §7 audit — saya sengaja tidak memilihkan supaya ini
   keputusan strategi submission-mu sendiri.
4. **Skala deployment nyata produk ini** — apakah realistis multi-tenant sungguhan (celah
   F-01 langsung P0 mendesak), atau untuk konteks case study ini single-tenant demo (F-01
   tetap harus disebut, tapi urgensinya bisa kamu framing beda di laporan)?
