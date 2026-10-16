# AI-Generated Code Risks & Mitigations

Dokumen ini mendokumentasikan analisis kritis terhadap kesalahan, kerentanan, dan risiko nyata dari kode yang dihasilkan oleh AI (*AI-generated code risks*) dalam repositori ini, beserta metodologi verifikasi empiris dan langkah mitigasi/perbaikannya.

---

## 1. Analisis Risiko Utama: Fatal String Encoding Crash pada PDF Subsystem

### 1.1 Deskripsi Kesalahan Kode AI
Pada modul `Exports::PdfGenerator` (`api/app/services/exports/pdf_generator.rb`), kode yang di-generate AI mencetak teks laporan evaluasi ke dalam dokumen PDF menggunakan pustaka `prawn` dan `prawn-table`:

```ruby
# Kode asli hasil generate AI yang bermasalah:
def render_skill_card(pdf, skill)
  override = skill.assessor_override
  effective_level = override ? override.override_level : skill.ai_level

  pdf.font_size(11) do
    pdf.text "#{skill.skill_label}", style: :bold
    level_text = "Level: #{LEVEL_LABELS[effective_level]}"
    # BUG: Menggunakan karakter Unicode panah '→'
    level_text += " (AI: #{LEVEL_LABELS[skill.ai_level]} → Override: #{LEVEL_LABELS[override.override_level]})" if override
    level_text += "  |  Confidence: #{CONFIDENCE_LABELS[skill.ai_confidence] || skill.ai_confidence}"
    pdf.text level_text
  end
  # ...
  if skill.evidence.any?
    pdf.move_down 4
    pdf.font_size(10) do
      pdf.text "Evidence:", style: :bold
      # BUG: Menggunakan karakter Unicode bullet '•' dan tanda petik kurva '“' '”'
      skill.evidence.each { |quote| pdf.text "  • #{quote}" }
    end
  end
end
```

### 1.2 Mengapa Model AI Membuat Kesalahan Ini (*Root Cause of AI Blindspot*)
1. **Asumsi Universal UTF-8 Support Tanpa Konteks Pustaka**:
   - Model bahasa besar (LLM) dilatih pada teks web modern yang hampir 100% menggunakan encoding UTF-8. Akibatnya, LLM secara alami gemar menggunakan glif tipografi yang estetik seperti panah Unicode (`→`), bullet point (`•`), em-dash (`—`), dan petik lengkung (`“ ”`).
2. **Keterbatasan Font Standar Prawn (AFM / Adobe Font Metrics)**:
   - Tanpa file font TrueType (`.ttf`) eksternal yang di-embed secara eksplisit, pustaka Prawn di Ruby menggunakan 14 font standar Adobe bawaan (Helvetica, Times, Courier) yang mengandalkan tabel karakter `Windows-1252` (8-bit).
   - Karakter Unicode seperti `→` (`\u2192`) dan `•` (`\u2022`) tidak ada di Windows-1252. Ketika Prawn mencoba menormalisasi encoding via `normalize_encoding`, pustaka melempar:
     ```text
     Prawn::Errors::IncompatibleStringEncoding: Your document includes text that's not compatible with the Windows-1252 character set.
     ```
3. **Kegagalan Menangani Input Dinamis dari Transkrip Kandidat**:
   - AI hanya menguji skenario ideal dengan string ASCII sederhana. Di dunia nyata, transkrip percakapan kandidat dan catatan asesor sering memuat tanda kutip kurva, tanda pisah, atau bahkan emoji.

### 1.3 Metodologi Verifikasi Empiris
1. **Verifikasi Manual via HTTP Request**:
   - Menjalankan sesi wawancara hingga selesai, memberikan assessor override, lalu meminta ekspor PDF:
     ```bash
     curl -s -i -H "Authorization: Bearer <TOKEN>" \
       "http://127.0.0.1:3001/api/v1/portfolios/1/export?format=pdf&vacancy_id=1"
     ```
   - **Hasil**: HTTP 500 Internal Server Error dengan trace `IncompatibleStringEncoding`.
2. **Seeded Fault Verification di Scratch Branch (`test/seeded-fault-scratch`)**:
   - Dibuat branch uji `test/seeded-fault-scratch`.
   - Logika transliterasi sengaja dinonaktifkan (`text.to_s`).
   - Eksekusi `bundle exec rspec spec/services/exports/pdf_generator_spec.rb` membuktikan secara deterministik bahwa 6 test case gagal seketika:
     - Gagal pada karakter panah (`→`)
     - Gagal pada bullet (`•`) dan dash (`—`)
     - Gagal pada smart quotes (`“ ”`)
     - Gagal pada non-breaking space (`\u00A0`)
     - Gagal pada encoding conversion fallback.

### 1.4 Solusi & Perbaikan Komprehensif
Kami menerapkan layer transliterasi universal deterministik `Exports::PdfGenerator.clean_str(text)`:
1. **Kamus Pemetaan Unicode ke Representasi Tipografi Aman**:
   - `→` dipetakan ke `->`
   - `•`, `–`, `—`, `―` dipetakan ke `-`
   - `“`, `”` dipetakan ke `"`
   - `‘`, `’` dipetakan ke `'`
   - `…` dipetakan ke `...`
   - `✓`, `✔` dipetakan ke `[v]`
   - `\u00A0` (non-breaking space) dipetakan ke spasi biasa `" "`
   - `\u200B` (zero-width space) dihapus `""`
2. **Defensive Transcoding**:
   - Memanggil `.encode('Windows-1252', invalid: :replace, undef: :replace, replace: '?')` untuk memastikan karakter tak terduga apa pun tidak pernah menggagalkan eksekusi PDF.
3. **Null & Type Safety**:
   - Memastikan input `nil`, angka, atau boolean tidak memicu `NoMethodError`.
4. **Hasil Verifikasi Pasca Perbaikan**:
   - Seluruh 17 RSpec test cases lulus 100% (*green*).
   - Ekspor PDF melalui endpoint HTTP menghasilkan `200 OK` dengan header binary attachment yang valid.

---

## 2. Risiko Tambahan: Tenant Isolation Bypass pada Controller AI-Generated

### 2.1 Deskripsi Kesalahan
Pada `api/app/controllers/api/v1/portfolios_controller.rb`:
```ruby
def set_portfolio
  if @session
    @portfolio = @session.portfolio
  else
    @portfolio = Portfolio.find(params[:id]) # BUG: Tidak ada scoping tenant!
  end
end
```
Model `Portfolio` tidak memiliki kolom `tenant_id` langsung di tabelnya (kolom `tenant_id` berada di tabel `sessions`). Akibatnya, AI tidak menyertakan modul `TenantScoped` pada model `Portfolio`, dan controller mencari portfolio murni berdasarkan ID numerik tanpa memeriksa apakah sesi tersebut milik organisasi pengguna yang sedang login.

### 2.2 Dampak Keamanan (*Security Impact*)
*Insecure Direct Object Reference (IDOR)*. Asesor dari Tenant A dapat mengunduh portfolio rahasia kandidat dari Tenant B hanya dengan menebak parameter ID di URL (`/portfolios/2/export`).

### 2.3 Solusi Perbaikan
Memperketat query di `set_portfolio` dengan scoping tenant eksplisit:
```ruby
def set_portfolio
  if @session
    @portfolio = @session.portfolio
  else
    @portfolio = Portfolio.joins(:session)
                          .where(sessions: { tenant_id: current_tenant_id })
                          .find_by(id: params[:id])
  end

  return json_error("Portfolio not found", :not_found) unless @portfolio
end
```
Divalidasi dengan automated test:
```ruby
context 'when accessed by another tenant (tenant boundary isolation)' do
  it 'rejects cross-tenant access with 404 Not Found' do
    get "/api/v1/portfolios/#{portfolio_1.id}/export?format=pdf", headers: headers_org_2
    expect(response).to have_http_status(:not_found)
  end
end
```

---

## 3. Pembelajaran Utama untuk Tim Engineering
1. **Jangan Percayai AI untuk Dependensi Pustaka Khusus (Prawn/EventMachine)**:
   - LLM kerap mengasumsikan API ideal yang seragam. Dokumentasi batas pustaka (seperti batas encoding AFM font Prawn atau keterbatasan event loop di OS tertentu) harus selalu divalidasi oleh engineer melalui unit test dan integrasi nyata.
2. **Pola Multi-Tenancy Membutuhkan Audit Relasi Bersarang**:
   - Jika suatu model tidak memiliki foreign key `tenant_id` secara langsung, jangan biarkan controller melakukan `Model.find(params[:id])` tanpa joining ke parent table yang memiliki `tenant_id`.
3. **Automated Test adalah Penjaga Mutlak Kualitas AI Code**:
   - Kode AI harus selalu disertai dengan unit test berskala boundary values (karakter khusus, nil, multi-tenant) untuk mendeteksi kelemahan tersembunyi sebelum masuk ke production.
