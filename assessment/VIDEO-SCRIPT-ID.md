# Skrip Video — langkah demi langkah

**Target 4:30. Maksimal 5:00.**

Tiap bagian ada tiga hal:

- **TAMPILKAN** — apa yang ada di layar
- **LAKUKAN** — apa yang Anda klik atau scroll
- **UCAPKAN** — baca keras-keras, kata per kata

Kalimatnya sengaja dibuat pendek. Baca pelan. Tidak apa-apa berhenti sebentar antar kalimat — jeda terdengar percaya diri, buru-buru tidak.

> Istilah teknis sengaja dibiarkan dalam Bahasa Inggris (fit/gap report, tenant, override, migration). Itu cara engineer Indonesia bicara sehari-hari, dan menerjemahkannya justru terdengar aneh.

---

## Sebelum merekam

**1. Hapus data tes.** Anda sempat membuat assessment "Senior FE" waktu explore. Hapus supaya daftarnya terlihat rapi:

```bash
cd D:/Project/Testing/Rakamin/ai-interview-platform
docker compose exec api bundle exec rails runner "Current.tenant_id=1; a=Assessment.find_by(name:'Senior FE'); a&.sessions&.destroy_all; a&.destroy; puts 'removed'"
```

**2. Jalankan semuanya.**

```bash
docker compose up -d
```

```bash
cd web && npm run dev
```

Tunggu sampai `curl http://localhost:3001/health` mengembalikan `{"status":"ok"}`.

**3. Buka tab berikut, urut.** Supaya Anda tidak pernah menunggu loading saat merekam.

| Tab | Isi |
|---|---|
| 1 | `assessment/screenshots/00-BEFORE-fitgap-desktop.png` — buka di image viewer, full screen |
| 2 | http://localhost:5173/assessments/2/sessions/2/fitgap/2 |
| 3 | Editor, buka file `api/app/services/portfolios/generator.rb` |
| 4 | Terminal, sudah di-clear, posisi di root repo |

**4. Setelan.** Zoom browser **110%**. Rekam minimal 1280×800. Tutup Slack, WhatsApp, email — jangan ada notifikasi muncul di layar.

**5. Rekam tes 20 detik dulu.** Pastikan mikrofon benar-benar terekam sebelum Anda rekam penuh.

---

## BAGIAN 1 — Masalahnya (0:00 – 0:35)

**TAMPILKAN:** Tab 1, screenshot "before", full screen.

**UCAPKAN:**

> "Platform ini mewawancarai kandidat dengan AI. Menilai mereka berdasarkan behavioural anchors. Lalu memberi recruiter sebuah fit-gap report."

> "Saya mau mulai dari bagaimana report itu terlihat sebelum saya ubah."

**LAKUKAN:** Gerakkan mouse pelan-pelan ke bawah, menyusuri kolom **Required** yang kosong.

**UCAPKAN:**

> "Kolom ini namanya Required. Ini level yang dibutuhkan oleh role tersebut. Kolomnya kosong di semua baris."

> "Jadi ini gap report yang tidak bisa memberi tahu kita, gap-nya diukur dari mana."

**LAKUKAN:** Arahkan mouse ke baris summary di bawah.

**UCAPKAN:**

> "Dan summary ini bilang satu match, dua gap, satu exceeds. Itu empat skill. Padahal role ini butuh tujuh."

> "Tiga skill tidak pernah dinilai sama sekali. Mereka tidak muncul di hitungan mana pun. Recruiter yang membaca ini akan mengira dia sedang melihat evaluasi yang lengkap."

---

## BAGIAN 2 — Kenapa bisa terjadi (0:35 – 1:35)

**TAMPILKAN:** Tab 3, editor.

**UCAPKAN:**

> "Awalnya saya kira ini cuma bug tampilan. Ternyata bukan. Akarnya sampai ke database."

**LAKUKAN:** Jalankan ini di Tab 4 supaya kode aslinya muncul di layar:

```bash
git show main:api/app/services/portfolios/generator.rb | grep -n "clamp"
```

**UCAPKAN:**

> "Kolom `ai_level` itu NOT NULL, dengan check constraint satu sampai lima. Jadi tidak ada cara untuk menyimpan informasi *skill ini tidak kami nilai*."

> "Akibatnya kodenya melakukan ini."

**LAKUKAN:** Tunjuk bagian `to_i.clamp(1, 5)`.

**UCAPKAN (pelan — ini kalimat paling penting di video):**

> "`nil.to_i` hasilnya nol. Nol di-clamp ke rentang satu sampai lima, jadinya **satu**."

> "Dan L1 di taxonomy ini artinya: mengerjakan dengan arahan eksplisit. Belum bisa bekerja mandiri."

*Berhenti satu detik.*

> "Jadi skill yang sebenarnya cuma tidak sempat ditanyakan karena waktu wawancara habis, tercatat permanen di evaluasi orang sungguhan sebagai kelemahan yang terdokumentasi."

> "Sistemnya mengubah *tidak adanya bukti* menjadi *bukti ketidakmampuan*. Lalu menyembunyikannya di summary yang jumlahnya tidak pernah pas."

> "Frontend-nya punya bug yang sama, terpisah. `parseLevel` juga mengembalikan satu kalau gagal parsing. Dua layer berbeda sama-sama memutuskan bahwa *tidak tahu* berarti *paling rendah*."

---

## BAGIAN 3 — Perbaikannya (1:35 – 2:25)

**TAMPILKAN:** Tab 2, report yang sudah diperbaiki.

**UCAPKAN:**

> "Kandidat yang sama. Data yang sama. API yang sama."

**LAKUKAN:** Tunjuk kolom Required.

**UCAPKAN:**

> "Sekarang Required terisi di semua baris."

**LAKUKAN:** Tunjuk banner abu-abu di atas tabel.

**UCAPKAN:**

> "Dan di atas tabel: tiga dari tujuh skill tidak dinilai. Ini gambaran yang belum lengkap tentang kandidat. Tidak adanya bukti bukan berarti ada kekurangan."

**LAKUKAN:** Tunjuk angka summary.

**UCAPKAN:**

> "Hitungannya sekarang totalnya tujuh. Dan baris yang tidak dinilai warnanya abu-abu, bukan merah. Itu informasi yang hilang, bukan temuan negatif tentang seseorang."

**LAKUKAN:** Arahkan mouse ke badge `✎ was L3` di baris *Testing & Quality Assurance*. Tahan supaya tooltip-nya muncul.

**UCAPKAN:**

> "Di sini assessor meng-override model, dari L3 turun ke L2. Report yang lama menampilkan L2 tanpa tanda apa pun bahwa ada manusia yang mengubahnya."

> "Flag-nya sebenarnya sudah ada di engine. Dihitung, lalu dibuang sebelum dikirim. Sementara tampilannya tetap mencetak legend yang menjanjikan penanda yang tidak akan pernah muncul."

**LAKUKAN:** Scroll ke bawah, ke kartu narasi.

**UCAPKAN:**

> "Narasi ini live dari Gemini. Perhatikan isinya: skill-skill ini tidak dinilai, jadi ini tidak boleh dianggap evaluasi yang lengkap."

> "Saya ubah prompt-nya supaya wajib menyebutkan itu. Jadi kejujurannya tetap terjaga di layer AI, bukan cuma di fallback."

---

## BAGIAN 4 — Temuan keamanan (2:25 – 3:05)

**TAMPILKAN:** Tab 4, terminal.

**LAKUKAN:** Jalankan ini supaya kode lamanya muncul:

```bash
git show main:api/app/controllers/api/v1/portfolios_controller.rb | grep -n "Portfolio.find"
```

**UCAPKAN:**

> "Saat menelusuri controller, saya menemukan sesuatu yang lebih serius."

> "Assessment, Session, dan Vacancy semuanya tenant-scoped. Portfolio tidak punya tenant id, dan tidak ada scoping sama sekali."

> "Semua lookup-nya global find, pakai integer berurutan."

> "Jadi assessor mana pun yang sudah login bisa membaca kandidat milik perusahaan lain. Termasuk export PDF-nya, yang isinya kutipan wawancara apa adanya."

**LAKUKAN:** Jalankan:

```bash
git show main:api/app/controllers/api/v1/portfolio_skills_controller.rb | grep -n "joins"
```

**UCAPKAN:**

> "Dan yang ini kelihatannya sudah dijaga. Ternyata tidak. `joins` tidak menambahkan filter tenant kalau model yang di-join memang tidak di-scope."

> "Itu artinya cross-tenant **write**. Anda bisa mengubah evaluasi hiring perusahaan lain, dan tercatat atas nama user id Anda sendiri."

> "Menurut UU PDP, itu pelanggaran pembatasan tujuan pemrosesan data pribadi, bukan sekadar bug otorisasi."

> "Saya menambahkan concern yang menurunkan tenant dari session. Saya buat explicit scope, bukan default scope, karena background worker memang berjalan tanpa tenant. Saya lebih memilih syaratnya terlihat jelas di setiap pemanggilan daripada tersembunyi."

---

## BAGIAN 5 — Pembuktian (3:05 – 4:00)

**TAMPILKAN:** Tab 4, terminal.

**LAKUKAN:** Jalankan:

```bash
docker compose exec -e RAILS_ENV=test api bundle exec rspec
```

**UCAPKAN:**

> "Lima puluh empat example. Waktu saya mulai, folder spec-nya tidak ada. File `.rspec` ada, tapi menunjuk ke tempat kosong."

**LAKUKAN:** Jalankan:

```bash
cd web && npm test
```

**UCAPKAN:**

> "Delapan belas di frontend. Di sana juga belum ada test runner sama sekali."

*Berhenti sebentar.*

> "Tapi test yang hijau cuma membuktikan kode melakukan apa yang dia lakukan. Jadi saya rusak sengaja."

**LAKUKAN:** Jalankan:

```bash
git show 075e96e --stat
```

**UCAPKAN:**

> "Saya kembalikan kedua bug tadi di branch terpisah, supaya bisa melihat test-nya gagal."

> "Mengembalikan clamp menghasilkan tujuh kegagalan. Nil, string kosong, kata 'three', nol, dan sembilan semuanya kembali jadi level, bukan nil."

> "Mengembalikan nama field lama menghasilkan tiga kegagalan."

> "Yang paling saya suka yang ini: *found multiple elements with the text em-dash*. Waktu bug-nya ada, kolom Required juga jatuh ke tanda strip. Jadi baris yang tidak dinilai menampilkan dua strip."

> "Itu sidik jari persis dari bug aslinya. Dan bisa dilihat di screenshot before yang saya buka di awal tadi."

> "Bug yang saya tanam dan revert-nya, dua-duanya ada di git history."

---

## BAGIAN 6 — Yang belum saya selesaikan (4:00 – 4:30)

**TAMPILKAN:** Bebas. Wajah Anda, atau report. Bagian ini diucapkan saja.

**UCAPKAN:**

> "Ada dua hal yang sengaja tidak saya tutup."

> "Pertama. Saya memperbaiki empat model yang saya temukan tidak ter-scope. Model berikutnya yang ditambahkan orang lain akan membuka lubang itu lagi. Ini butuh guard di level arsitektur, bukan empat tambalan. Saya belum mau bilang pekerjaan tenancy ini selesai."

> "Kedua. Tabel users tidak punya tenant id. Itu tabel global yang dipakai bersama dengan API utama. Dari repository ini saja saya tidak bisa memastikan apakah keanggotaan user ke organisasi sudah divalidasi di sisi upstream. Kalau belum, perbaikan saya perlu tapi belum cukup. Itu pertanyaan yang ingin saya dapat jawabannya sebelum ini rilis."

> "Satu hal terakhir. Migration-nya menolak untuk di-rollback selama masih ada baris yang belum ternilai. Dia tidak mengisi ulang ke L1. Karena itu akan diam-diam merugikan kandidat-kandidat tadi, saat operator mengira dia hanya melakukan rollback biasa."

> "Terima kasih."

---

## Aturan main

**Jangan lewati Bagian 6.** Mengakui apa yang belum selesai dan alasannya justru terbaca sebagai pertimbangan matang. Dan itu memang yang diminta di brief — mereka menyebutnya *constraint signal*.

**Kalau kepanjangan,** jangan potong Bagian 2, 4, atau 5. Potong Bagian 3 — screenshot sudah menjelaskannya.

**Kalau salah ngomong,** berhenti, diam dua detik, ulangi kalimatnya. Jedanya bisa dipotong nanti. Jangan mengulang rekaman dari awal.

---

## Pertanyaan yang kemungkinan besar ditanyakan

Siapkan jawabannya. Ini tiga keputusan yang paling gampang dipertanyakan, dan jawabannya bagus.

**"Kenapa yang diubah frontend-nya, bukan API-nya, untuk `required_level`?"**

> `skill_comparisons` disimpan sebagai JSONB. Semua report yang sudah tersimpan isinya `expected_level`. Mengubah sisi client memperbaiki semuanya tanpa perlu backfill. Selain itu, satu nama konsisten dari kolom database, lewat service, sampai ke PDF export — yang memang sudah membaca key yang benar. Kalau API-nya yang diganti nama, PDF export-nya justru rusak.

**"Kenapa tidak pakai `default_scope` untuk tenancy?"**

> Sidekiq worker berjalan di luar request, tanpa tenant di RequestStore. Dengan default scope, worker akan diam-diam tidak melihat apa pun, atau saya harus menaburkan `unscoped` di mana-mana. Explicit scope membuat syaratnya terlihat di tempat yang penting.

**"Kenapa nullable, bukan enum `evidence_state`?"**

> Satu kolom nullable, dibanding enum baru plus backfill plus jalur tulis baru di generator. Perbedaan antara *tidak pernah ditanyakan* dan *bukti tidak cukup* diturunkan di report layer, karena di situlah manusia membacanya. Kalau nanti perlu di-query lewat SQL, enum itu migration berikutnya — dan logika turunannya sudah mendefinisikan artinya.

**"Berapa banyak yang ditulis AI?"**

Jawab jujur. Brief-nya memang menganjurkan pakai AI, tapi minta Anda memverifikasinya. Siapkan satu contoh nyata — yang paling kuat ada di report: ada komentar kode usang yang mengklaim endpoint fit/gap mengecek override. Padahal tidak. Temuan itu terlihat meyakinkan, dan ternyata salah — `regenerate_stale_fitgap_reports` menanganinya dari sisi endpoint override. Mengecek jalur tulisnya dulu sebelum menuliskan temuan itulah yang menyelamatkannya.
