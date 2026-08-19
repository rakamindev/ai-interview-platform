# Laporan Eksekusi — Integritas Transkrip & Kesehatan Generasi Portofolio

Ringkasan pelaksanaan work order tambahan (pilar Sejarah SistemVersi P0) pada aplikasi AI Interview Platform.
Dokumen ini mencatat apa yang benar-benar dialami selama eksekusi — bukan retrospeksi ideal.

## 1. Konteks & Fault yang Di-seed

- Session 10 (`gg`) menghasilkan transkrip yang rusak saat direkam: sebagian besar konten kandidat dirender
  sebagai hallucination multibahasa (`水`, `응`, `Sí sí`) alih-alih jawaban asli.
- Dengan transkrip itu, AI portfolio menghasilkan evidence yang meyakinkan secara format tetapi **tidak bermakna** —
  bukti bahwa tanpa penjaga kualitas, sistem akan menyajikan hasil yang kelihatan sah tetapi isinya sampah.
- Men-deploy hasil itu apa adanya akan menyesatkan asseor. Ini direkam sebagai **bug kronis P0**
  (Sejarah SistemVersi integritas data). Log API mencatat dampak lanjutannya: error 500 saat ekspor PDF
  karena karakter non-WinAnsi (`Prawn::Errors::IncompatibleStringEncoding`).

## 2. Perbaikan yang Dikerjakan

| # | Perbaikan | File utama | Commit |
|---|-----------|------------|--------|
| 1 | Penjaga integritas transkrip + status `unverifiable` | `api/app/services/transcript_integrity.rb`, `api/app/services/sessions/end_handler.rb`, `api/app/models/portfolio.rb` | `42ca013` |
| 2 | Retry 429 yang sehat + pesan kesalahan yang jelas | `api/app/clients/gemini/http_client.rb` | `9bc35c1` |
| 3 | Ekspor PDF robust (non-WinAnsi) + guard "complete wajib punya bukti" | `api/app/services/exports/pdf_generator.rb`, `api/app/services/portfolios/generator.rb` | `6b20aab` |
| 4 | Filter parameter sensitif/PII dari log (UU PDP) | `api/config/initializers/filter_parameter_logging.rb` | `2f5068d` |
| 5 | UI portfolio 4 status (ready/generating/failed/unverifiable) + manual override | `web/src/pages/portfolio/PortfolioPage.tsx` dkk. | `9bf5d60` |
| 6 | Dokumen ini | `docs/execution.md` | `4448d5e` |
| 7 | Migrasi enum + seeded-fault test `EndHandler` (menemukan bug enum PG) | `db/migrate/20260819000001_*`, `spec/services/sessions/end_handler_spec.rb` | `50a66ed` |
| 8 | Designed failure paths: duplicate-job guard + partial-write rollback | `api/app/services/portfolios/generator.rb`, `spec/services/portfolios/generator_spec.rb` | `0f49d36` |

### 2.7 Penemuan bug oleh seeded-fault test

Pengujian *seeded fault* (mengalirkan transkrip rusak `응水 水응…` ke `Sessions::EndHandler`)
tidak lolos pada percobaan pertama dan justru menangkap cacat produksi:

- `PG::InvalidTextRepresentation: invalid input value for enum generation_status: "unverifiable"`.
- Penyebab: kolom `generation_status` adalah **PostgreSQL enum**, bukan string — nilai `unverifiable`
  belum ada di tipe enum, sehingga seluruh path penjaga integritas akan **crash saat write**.
- Perbaikan: migrasi `ALTER TYPE generation_status ADD VALUE ... 'unverifiable'` (`disable_ddl_transaction!`
  karena PG tidak boleh `ADD VALUE` dalam transaksi). Migrasi ini irreversibel oleh desain (PG tidak
  mendukung `DROP VALUE`).
- Ini contoh konkret mengapa *seeded fault test* diwajibkan: bug hanya muncul ketika fault benar-benar
  dialirkan melalui jalur produksi, bukan unit test.

### 2.8 Designed Failure Paths

Empat jalur kegagalan dari standar minimum di-handle secara eksplisit:

- **Timeouts** — `http_client.rb` meneruskan `timeout: 180` ke Faraday; `Faraday::TimeoutError`
  diterjemahkan jadi `Gemini::TimeoutError` (subclass `ApiError`) → `Portfolios::Generator` menangkapnya →
  portfolio berstatus `failed` dengan pesan yang bisa dibaca.
- **Model errors** — error API non-429 diubah jadi `ApiError` dengan `status` + body; hal yang sama, alur
  `rescue` mengubah status jadi `failed` (bukan silent).
- **Partial writes** — `save_skills` + transisi ke `complete` dibungkus satu transaksi (`persist_result`).
  Jika `create!` gagal di tengah, semua baris skill parsial di-rollback. Ada satu jebakan AR yang ditemukan
  saat itu (lihat §6.3): menulis status `failed` lewat record yang sama *setelah* savepoint di-rollback
  justru mem-persist ulang anak yang sudah di-rollback — solusinya `portfolio.reload` dulu (menulis dari
  kebenaran DB, bukan cache memori).
- **Duplicate jobs** — pekerjaan di-flip ke `generating` dibawah `with_lock` (row lock) sehingga dua worker
  / regenerate yang balapan dengan job asli tidak bisa memanggil Gemini dua kali untuk transkrip yang sama.
  Spec membuktikan: job ganda pada portfolio `complete` langsung di-skip tanpa memanggil model.

### 2.9 Protected Data — catatan reversibilitas migrasi

Standar minimum meminta migrasi *reversible*. Empat migrasi lama bersifat reversible (`change`/`up`+`down`).
Satu pengecualian disengaja:

- `20260819000001_add_unverifiable_to_generation_status.rb` — PostgreSQL tidak mendukung `DROP VALUE` pada
  enum, jadi `down` diberi `IrreversibleMigration`. Ini bukan pilihan, melainkan batasan platform.
- Rollback manual tetap didokumentasikan: buat tipe baru tanpa nilai tersebut, pindahkan kolom, drop enum lama.
- Aman terhadap baris yang ada: `ADD VALUE IF NOT EXISTS` tidak menyentuh data existing.

### 2.1 Momen verifikasi AI (transcript integrity guard)

`TranscriptIntegrity` memeriksa transkrip dengan ambang batas eksperimental:

- `MIN_CANDIDATE_CHARS = 120` — panjang minimum suara kandidat.
- `MIN_ENGLISH_RATIO   = 0.6` — rasio token Latin minimal.
- `MAX_NON_LATIN_RATIO = 0.2` — toleransi token non-Latin (mis. karakter CJK/Korean).

Jika tidak lolos → portfolio dibuat dengan status `unverifiable` + `generation_error` berbahasa Indonesia,
dan **job generasi di-skip** (tidak membuang kuota Gemini ke transkrip yang sudah jelas rusak).

Momen yang membuktikan guard bekerja secara nyata: portfolio 6 yang dihasilkan sebelumnya sudah otomatis
diputus dengan alasan kualitas transkrip, sehingga sistem menolak menyajikan hasil sebelum divalidasi manusia.

### 2.2 Kuota Gemini free-tier & retry 429

Yang dialami selama eksekusi: kuota gratis dibatasi ±20 permintaan per hari per project. Dua API key pertama
(project yang sama) kena `429`, key ketiga dari project baru berhasil.

Perbaikan `http_client.rb`:
- Faraday **tidak** meretry 429; hanya `500/502/503` yang diserahkan ke retry middleware.
- 429 diubah menjadi `Gemini::HttpClient::RateLimitError` dengan pesan berbahasa Indonesia + petunjuk
  (retry-after / rotasi key) sehingga Sidekiq bisa mundur dengan backoff yang sehat, bukan menabrak kuota.

### 2.3 Ekspor PDF robust

Karakter di luar WinAnsi (mis. `水`, `응`) membuat Prawn melempar `IncompatibleStringEncoding` → 500.
Helper `winansi` menormalkan teks: encode `Windows-1252` dengan `replace`, lalu kembali ke UTF-8, sehingga
PDF selalu bisa dirender. Spec baru membuktikan karakter non-WinAnsi tidak lagi menyebabkan error.

### 2.4 "Complete" wajib punya bukti

`Portfolios::Generator` kini menolak menandai portfolio `complete` bila model mengembalikan **nol skill** —
ini gagal dengan status `failed` + pesan jelas, supaya status sukses tidak pernah berdiri tanpa evidence.

### 2.5 Privasi / UU PDP

- `api/config/application.yml` (berisi API key) sudah di-`gitignore` dan tidak ter-track.
- Log dan `/tmp` di-`gitignore`.
- Parameter sensitif + PII (`token`, `api_key`, `invite_token`, `candidate_name`, `candidate_id`, dll.)
  kini disaring dari log via `filter_parameter_logging.rb`.

### 2.6 UI portfolio 4 status

Halaman portfolio kini membedakan 4 status: generating (polling), failed (retry), complete (isi hasil),
dan **unverifiable** — menampilkan alasan, tombol "Review Transcript", dan **manual override** ("Regenerate
anyway") dengan konfirmasi eksplisit. Tidak ada ajakan mengulang wawancara, karena kandidat tidak bisa
diwawancarai ulang.

## 3. Verifikasi

- `bundle exec rspec` → **18 examples, 0 failures** (spec pertama yang ada di repositori):
  - `spec/services/transcript_integrity_spec.rb` — guard + alasan berbahasa Indonesia
  - `spec/models/portfolio_spec.rb` — status `unverifiable`
  - `spec/services/sessions/end_handler_spec.rb` — **seeded fault test**: transkrip rusak → `unverifiable` + skip enqueue; transkrip sehat → `pending` + enqueue
  - `spec/clients/gemini/http_client_spec.rb` — 429 tanpa retry / 400 langsung / 200 ter-parse
  - `spec/services/exports/pdf_generator_spec.rb` — PDF dengan karakter non-WinAnsi
  - `spec/services/portfolios/generator_spec.rb` — 0 skill → `failed`; skill valid → `complete`; **job ganda → skip tanpa panggil model; partial write → rollback penuh**
- `npx tsc --noEmit` di `web/` → bersih (termasuk type `"unverifiable"`).
- Ekspor PDF berjalan normal kembali (tidak ada lagi 500).

### 3.1 Bukti scratch-branch (Seeded Fault Test formal)

Sesuai standar minimum, satu perbaikan dibuktikan dengan cara: **rusakkan logika → spec RED → revert →
spec GREEN**, dengan history yang terlihat:

- Branch `scratch-seeded-fault` dibuat dari tip `feature/portfolio-integrity`.
- Commit `e499f74` — dengan sengaja **membypass `winansi`** di `pdf_generator.rb`.
- Spec `pdf_generator_spec.rb` → **RED** (`Prawn::IncompatibleStringEncoding` — regression 500 balik).
- Commit `37d1e46` — `git revert` (mengembalikan kode yang benar), history tetap terlihat.
- Spec → **GREEN** kembali.
- Branch ini sengaja dibiarkan ada sebagai bukti (lihat catatan review PR).

## 4. Asumsi & yang sengaja tidak dikerjakan

- Ambang `TranscriptIntegrity` adalah nilai eksperimental pertama; kalibrasi lebih lanjut butuh dataset transkrip sehat.
- Manual override tetap menjalankan generasi dari transkrip yang sama — risiko hasil tidak bermakna ditanggung
  asseor yang menekan konfirmasi; ini disengaja sebagai jalan keluar manusia.
- Tidak dilakukan penjadwalan ulang percakapan (retake) karena tidak mungkin secara praktik.
- Migrasi enum `unverifiable` **dibutuhkan** dan sudah diterapkan (lihat §2.7). Sebelumnya diasumsikan tidak
  perlu migrasi — klaim itu salah dan dipatahkan oleh seeded-fault test.

## 5. Momen Verifikasi AI (AI Verification Moment)

Tiga kejadian di mana keluaran AI (produk dan hasil pembangkitan kode) terbukti salah/berisiko, dan bagaimana
saya memverifikasi lalu mengoreksinya:

### 5.1 AI produk: hallucination transkrip → penilaian menyesatkan

- **Salahnya:** Gemini menghasilkan kutipan bukti meyakinkan tapi tak bermakna (`水`, `응`, `Sí sí`) dari
  audio yang tidak terbaca → kandidat akan dinilai L1 palsu.
- **Verifikasi:** inspeksi record DB + payload portfolio 6 langsung; ketidakwajaran (multibahasa dalam satu
  sesi berbahasa Inggris) dikonfirmasi sebagai P0.
- **Koreksi:** guard `TranscriptIntegrity` + status `unverifiable` + skip generasi; dibuktikan oleh
  seeded-fault test `end_handler_spec.rb`.

### 5.2 Klaim AI (saya) "status berupa string, tidak perlu migrasi" — salah

- **Salahnya:** commit #1 awalnya mengasumsikan `generation_status` adalah kolom string sehingga disimpulkan
  "tanpa migrasi DB, aman untuk data lama".
- **Verifikasi:** menulis spec *alur produksi penuh* (bukan unit test) — `end_handler_spec.rb` langsung gagal
  dengan `PG::InvalidTextRepresentation: invalid input value for enum generation_status: "unverifiable"`.
- **Koreksi:** migrasi `20260819000001` (`ALTER TYPE ... ADD VALUE`). Ini contoh asumsi yang hanya kalah oleh
  bukti empiris dari test.

### 5.3 Kode yang saya hasilkan: menulis status `failed` setelah savepoint di-rollback

- **Berisikonya:** rescue `Portfolios::Generator#call` awalnya `portfolio.update!(...)` — kekhawatirannya
  savepoint rollback tetap menyisakan baris skill parsial.
- **Verifikasi:** spec partial-write (menyisipkan data skill yang sengaja invalid) menunjukkan jumlah baris
  tetap 1 — **AR mem-persist ulang anak dari cache memori** padahal DB sudah di-rollback.
- **Koreksi & verifikasi ulang:** `portfolio.reload` sebelum menulis status `failed` (membaca kebenaran DB);
  spec kembali hijau dengan `portfolio_skills.count == 0`.

## 6. Cara menjalankan ulang

```bash
# API (dari folder api/)
bundle exec rspec

# Web typecheck (dari folder web/)
npx tsc --noEmit
```