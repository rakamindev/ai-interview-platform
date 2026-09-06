# 01 — Domain Understanding

## Produknya

`rakamindev/ai-interview-platform` adalah **platform interview AI**. Stack-nya dua service:
`api/` = Rails 7.0.8 API-only (Ruby 3.3.2, PostgreSQL, Redis, Sidekiq, faye-websocket,
Prawn PDF, multi-tenant via RequestStore) dan `web/` = React 18 + TypeScript 5.5 +
Vite 6 + Tailwind + shadcn/ui + Jotai + axios.

**Yang membuat produk ini berbeda dari aplikasi biasa: ia menentukan hasil rekrutmen
orang lain.** Kalau rating-nya salah, ada manusia yang ditolak karena bug — dan manusia itu
tidak pernah memilih untuk dinilai, apalagi dinilai salah. Ini pintu masuk narasi brief
*"People Affected Who Never Chose It"*.

## Alur end-to-end (dari PRD + baca kode)

1. **Recruiter** membuat vacancy + assessment, memilih skill dari taxonomy B7
   (22 skill: engineering, soft skills, product/process). Tiap skill punya anchor
   level L1–L5.
2. **Kandidat** diundang, ikut hardware check, lalu wawancara **suara real-time**
   dengan Gemini Live lewat WebSocket.
3. **Selama wawancara**, transkrip dianalisis worker async (Gemini Flash) untuk mengisi
   **coverage map**: tiap skill bergerak `not_yet → initiated → partial → covered`.
   HARD RULE di PRD: butuh `probe_count >= 2` untuk lewat dari `initiated`.
4. Coverage map **di-inject balik ke prompt** supaya AI tahu skill mana yang belum tergali.
5. **Setelah sesi**, Gemini Pro membuat **portfolio**: level L1–L5 per skill +
   confidence (high/medium/low) + evidence.
6. Portfolio dibandingkan dengan requirement vacancy → **fit/gap report**
   (MATCH / GAP / EXCEED), bisa di-override assessor.

## Istilah kunci

| Istilah | Arti | Kenapa penting |
|---|---|---|
| `probe_count` | jumlah pertanyaan AI yang menyentuh satu skill | Gerbang transisi `initiated → partial`; PRD memaklumkan HARD RULE `>= 2` |
| Coverage map | posisi tiap skill di `not_yet → initiated → partial → covered` | Bahan bakar portfolio generator; kalau cacat di sini, racunnya menular ke hasil akhir |
| `last_signal` | alasan terakhir AI menaikkan status sebuah skill | **Dibaca portfolio generator sebagai evidence** — kalau diisi string robot, portfolio mengutip kalimat robot itu sebagai alasan penilaian manusia |
| `ai_level` | level 1–5 per skill dari AI | Kontrak database: integer 1..5, NOT NULL, CHECK constraint (`api/db/schema.rb:115,120`) |
| `ai_confidence` | high/medium/low | Enum DB NOT NULL (`api/app/models/portfolio_skill.rb:4`) — "medium" **bukan** "confirmed" |
| Fit/gap report | perbandingan portfolio vs requirement vacancy | Output yang dilihat assessor untuk keputusan; bisa di-override |

## Tiga properti sistem yang membentuk tema "Integritas Penilaian"

1. **Nilai dihasilkan oleh model AI yang non-deterministik** — respons bisa salah bentuk,
   level hilang, confidence kosong. Konsekuensinya: setiap titik di mana data AI
   diterjemahkan ke angka/warna adalah titik yang bisa **mengarang penilaian**.
2. **Tidak ada jaring pengaman** — saat audit, `web/` tidak punya test/lint/CI sama sekali,
   dan `api/` punya toolchain RSpec lengkap di `Gemfile` tapi folder `spec/` tidak ada.
   Artinya: penilaian salah bisa sampai ke produksi tanpa ada satu pun alarm.
3. **Kegagalan diterjemahkan sebagai sukses** — pola yang paling berbahaya dan yang
   kupilih jadi perbaikan: error di awal wawancara menampilkan "Interview Complete",
   `level` kosong tampil sebagai L1 (rating terendah), confidence hilang tampil "LOW".
   Dalam ketiga kasus, *orangnya disuruh menerima kesimpulan dari sistem yang gagal*.

## Batas pemahaman jujur

- Pemahaman di atas berasal dari **dua halaman PRD di wiki repo + audit baca kode langsung**
  pada `api/` dan `web/`.
- **Jalanan langsung sebagai user (Step 2 brief) belum bisa kulakukan** — backend belum
  jalan di mesin ini (Ruby 3.3.2 + PostgreSQL belum terpasang), sehingga wawancara live
  tidak bisa dijalankan. Setelah setup selesai, bagian ini harus dilengkapi dengan
  walkthrough nyata: buat vacancy sebagai recruiter → undang → hardware check → wawancara
  → lihat portfolio → buat fit/gap.
- Beberapa angka di temuan (mis. perkiraan N+1 query) berasal dari pembacaan kode,
  **bukan pengukuran** — jangan dikutip sebagai hasil benchmark.

> **[PERLU SUARAMU — setelah backend jalan:** catat walkthrough-mu sendiri di sini:
> apa yang terasa benar, apa yang aneh, screenshot tiap layar. Bagian ini yang
> membedakan "membaca PRD" dari "menjalani produk". Tanpa ini, Step 2 brief belum lengkap.]
