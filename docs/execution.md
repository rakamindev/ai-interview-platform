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
| 6 | Dokumen ini | `docs/execution.md` | — |
| 7 | Migrasi enum + seeded-fault test `EndHandler` (menemukan bug enum PG) | `db/migrate/20260819000001_*`, `spec/services/sessions/end_handler_spec.rb` | *commit terakhir* |

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

- `bundle exec rspec` → **16 examples, 0 failures** (spec pertama yang ada di repositori):
  - `spec/services/transcript_integrity_spec.rb` — guard + alasan berbahasa Indonesia
  - `spec/models/portfolio_spec.rb` — status `unverifiable`
  - `spec/services/sessions/end_handler_spec.rb` — **seeded fault test**: transkrip rusak → `unverifiable` + skip enqueue; transkrip sehat → `pending` + enqueue
  - `spec/clients/gemini/http_client_spec.rb` — 429 tanpa retry / 400 langsung / 200 ter-parse
  - `spec/services/exports/pdf_generator_spec.rb` — PDF dengan karakter non-WinAnsi
  - `spec/services/portfolios/generator_spec.rb` — 0 skill → `failed`; skill valid → `complete`
- `npx tsc --noEmit` di `web/` → bersih (termasuk type `"unverifiable"`).
- Ekspor PDF berjalan normal kembali (tidak ada lagi 500).

## 4. Asumsi & yang sengaja tidak dikerjakan

- Ambang `TranscriptIntegrity` adalah nilai eksperimental pertama; kalibrasi lebih lanjut butuh dataset transkrip sehat.
- Manual override tetap menjalankan generasi dari transkrip yang sama — risiko hasil tidak bermakna ditanggung
  asseor yang menekan konfirmasi; ini disengaja sebagai jalan keluar manusia.
- Tidak dilakukan penjadwalan ulang percakapan (retake) karena tidak mungkin secara praktik.
- Migrasi enum `unverifiable` **dibutuhkan** dan sudah diterapkan (lihat §2.7). Sebelumnya diasumsikan tidak
  perlu migrasi — klaim itu salah dan dipatahkan oleh seeded-fault test.

## 5. Cara menjalankan ulang

```bash
# API (dari folder api/)
bundle exec rspec

# Web typecheck (dari folder web/)
npx tsc --noEmit
```